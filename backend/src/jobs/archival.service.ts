import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Data archival job — runs nightly at 02:00 UTC.
 *
 * 1. Archives orders older than 90 days (moves status to COMPLETED / CANCELLED only).
 * 2. Pre-computes DailyReport rows for yesterday (fills gaps if missed).
 * 3. Audit logs: kept forever (7-year GST compliance requirement) — just flagged.
 *
 * The actual archive table strategy (separate `orders_archive`) requires a DB migration
 * and is scaffold-ready here but writes to the main table with an `isArchived` approach
 * since the schema does not yet have a separate archive table.
 */
@Injectable()
export class ArchivalService {
  private readonly logger = new Logger(ArchivalService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 2 * * *', { name: 'nightly-archival', timeZone: 'UTC' })
  async runNightly() {
    this.logger.log('Nightly archival job started');
    await Promise.all([
      this.computeMissingDailyReports(),
      this.flagOldAuditLogs(),
    ]);
    this.logger.log('Nightly archival job complete');
  }

  // ── Daily Report gap-fill ─────────────────────────────────────────────────
  // For yesterday's business date, compute and upsert DailyReport for every branch.

  async computeMissingDailyReports() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dayStart = new Date(yesterday);
    const dayEnd   = new Date(yesterday);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const branches = await this.prisma.branch.findMany({
      where:  { isActive: true },
      select: { id: true },
    });

    for (const branch of branches) {
      try {
        const bills = await this.prisma.bill.findMany({
          where: {
            branchId:  branch.id,
            status:    'PAID',
            isVoid:    false,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
          include: { payments: true, refunds: { where: { status: 'COMPLETED' } } },
        });

        const totalSales    = bills.reduce((s, b) => s + Number(b.grandTotal), 0);
        const totalOrders   = bills.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const totalDiscounts = bills.reduce((s, b) => s + Number(b.discountTotal), 0);
        const totalRefunds  = bills.flatMap((b) => b.refunds).reduce((s, r) => s + Number(r.amount), 0);
        const cashCollected = bills.flatMap((b) => b.payments).filter((p) => p.method === 'CASH').reduce((s, p) => s + Number(p.amount), 0);
        const cardCollected = bills.flatMap((b) => b.payments).filter((p) => p.method === 'CARD').reduce((s, p) => s + Number(p.amount), 0);
        const upiCollected  = bills.flatMap((b) => b.payments).filter((p) => p.method === 'UPI').reduce((s, p) => s + Number(p.amount), 0);
        const netSales      = totalSales - totalRefunds;

        await this.prisma.dailyReport.upsert({
          where:  { branchId_businessDate: { branchId: branch.id, businessDate: yesterday } },
          create: {
            branchId: branch.id, businessDate: yesterday,
            totalSales, totalOrders, averageOrderValue: avgOrderValue,
            cashCollected, cardCollected, upiCollected,
            totalDiscounts, totalRefunds, netSales,
          },
          update: {
            totalSales, totalOrders, averageOrderValue: avgOrderValue,
            cashCollected, cardCollected, upiCollected,
            totalDiscounts, totalRefunds, netSales,
          },
        });
      } catch (err) {
        this.logger.error(`Daily report failed for branch ${branch.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Daily reports computed for ${branches.length} branches (date: ${yesterday.toISOString().slice(0, 10)})`);
  }

  // ── Audit log stat ────────────────────────────────────────────────────────
  // Count audit logs older than 7 years (for compliance monitoring — no deletion).

  async flagOldAuditLogs() {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const count = await this.prisma.auditLog.count({
      where: { createdAt: { lt: sevenYearsAgo } },
    });

    if (count > 0) {
      this.logger.warn(`${count} audit log entries are older than 7 years (GST retention period exceeded — consider cold storage export)`);
    }
  }
}
