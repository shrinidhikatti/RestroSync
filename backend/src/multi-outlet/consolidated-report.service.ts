import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsolidatedReportService {
  constructor(private prisma: PrismaService) {}

  private dateRange(from: string, to: string) {
    const start = new Date(from); start.setHours(0, 0, 0, 0);
    const end   = new Date(to);   end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // ── All branches of a restaurant — overview ────────────────────────────────

  async consolidatedOverview(restaurantId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const branches = await this.prisma.branch.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      branches.map(async (branch) => {
        const [billAgg, orderCount, cancelCount] = await Promise.all([
          this.prisma.bill.aggregate({
            where: { branchId: branch.id, status: 'PAID', isVoid: false, createdAt: { gte: start, lte: end } },
            _sum:   { grandTotal: true, discountTotal: true, taxTotal: true },
            _count: { id: true },
          }),
          this.prisma.order.count({
            where: { branchId: branch.id, status: { in: ['COMPLETED', 'BILLED'] }, createdAt: { gte: start, lte: end } },
          }),
          this.prisma.order.count({
            where: { branchId: branch.id, status: 'CANCELLED', createdAt: { gte: start, lte: end } },
          }),
        ]);

        const totalSales = Number(billAgg._sum.grandTotal) || 0;
        const billCount  = billAgg._count.id;

        return {
          branchId:       branch.id,
          branchName:     branch.name,
          totalSales:     +totalSales.toFixed(2),
          totalOrders:    orderCount,
          cancelledOrders: cancelCount,
          totalBills:     billCount,
          avgOrderValue:  orderCount > 0 ? +(totalSales / orderCount).toFixed(2) : 0,
          discounts:      +(Number(billAgg._sum.discountTotal) || 0).toFixed(2),
          tax:            +(Number(billAgg._sum.taxTotal)      || 0).toFixed(2),
        };
      }),
    );

    const totals = results.reduce(
      (acc, b) => ({
        totalSales:      +(acc.totalSales + b.totalSales).toFixed(2),
        totalOrders:     acc.totalOrders + b.totalOrders,
        cancelledOrders: acc.cancelledOrders + b.cancelledOrders,
        totalBills:      acc.totalBills + b.totalBills,
        discounts:       +(acc.discounts + b.discounts).toFixed(2),
        tax:             +(acc.tax + b.tax).toFixed(2),
      }),
      { totalSales: 0, totalOrders: 0, cancelledOrders: 0, totalBills: 0, discounts: 0, tax: 0 },
    );

    const topBranch = results.sort((a, b) => b.totalSales - a.totalSales)[0] ?? null;

    return {
      period:    { from, to },
      totals,
      topBranch: topBranch?.branchName ?? null,
      branches:  results.sort((a, b) => b.totalSales - a.totalSales),
    };
  }

  // ── Branch comparison — daily trend per branch ─────────────────────────────

  async branchComparison(restaurantId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const branches = await this.prisma.branch.findMany({
      where:  { restaurantId, isActive: true },
      select: { id: true, name: true },
    });

    const series: Record<string, Record<string, number>> = {};

    for (const branch of branches) {
      const bills = await this.prisma.bill.findMany({
        where: { branchId: branch.id, status: 'PAID', isVoid: false, createdAt: { gte: start, lte: end } },
        select: { grandTotal: true, businessDate: true, createdAt: true },
      });

      series[branch.name] = {};
      for (const b of bills) {
        const key = (b.businessDate ?? b.createdAt).toISOString().split('T')[0];
        series[branch.name][key] = (series[branch.name][key] ?? 0) + Number(b.grandTotal);
      }
    }

    // Build date range array
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const chartData = dates.map((date) => {
      const row: Record<string, string | number> = { date };
      for (const b of branches) {
        row[b.name] = +(series[b.name]?.[date] ?? 0).toFixed(2);
      }
      return row;
    });

    return {
      branches: branches.map((b) => b.name),
      chartData,
    };
  }

  // ── Top items across all branches ─────────────────────────────────────────

  async topItemsConsolidated(restaurantId: string, from: string, to: string, limit = 20) {
    const { start, end } = this.dateRange(from, to);

    const branches = await this.prisma.branch.findMany({
      where:  { restaurantId, isActive: true },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const items = await this.prisma.orderItem.groupBy({
      by: ['itemName', 'variantName'],
      where: {
        order: { branchId: { in: branchIds }, status: { in: ['COMPLETED', 'BILLED'] }, createdAt: { gte: start, lte: end } },
        status: { not: 'VOIDED' },
      },
      _sum:    { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take:    limit,
    });

    return items.map((i) => ({
      itemName:    i.itemName,
      variantName: i.variantName,
      totalQty:    i._sum.quantity ?? 0,
    }));
  }

  // ── Payment breakdown across all branches ─────────────────────────────────

  async consolidatedPayments(restaurantId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const branches = await this.prisma.branch.findMany({
      where:  { restaurantId, isActive: true },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        bill: { branchId: { in: branchIds }, isVoid: false },
        status:    'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      _sum:   { amount: true },
      _count: { id: true },
    });

    return payments.map((p) => ({
      method: p.method,
      total:  +(Number(p._sum.amount) || 0).toFixed(2),
      count:  p._count.id,
    }));
  }
}
