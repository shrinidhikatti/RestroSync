import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  // ─── File a complaint ─────────────────────────────────────────────────────
  // Voids the item from the bill and creates a tracked complaint record.

  async fileComplaint(
    orderId: string,
    branchId: string,
    restaurantId: string,
    reportedBy: string,
    dto: FileComplaintDto,
  ) {
    // Verify the order item belongs to this order / branch
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.orderItemId,
        orderId,
        order: { branchId },
        status: { not: 'VOIDED' },
      },
    });
    if (!item) {
      throw new NotFoundException('Order item not found or already voided');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Void the item so it drops off the bill
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          status:    'VOIDED',
          voidedAt:  new Date(),
          voidedBy:  reportedBy,
          voidReason: `Customer complaint: ${dto.reason}`,
        },
      });

      // 2. Create the complaint record
      const complaint = await tx.itemComplaint.create({
        data: {
          restaurantId,
          branchId,
          orderId,
          orderItemId:  item.id,
          menuItemId:   item.menuItemId ?? undefined,
          menuItemName: item.itemName,
          reason:       dto.reason,
          notes:        dto.notes ?? null,
          reportedBy,
        },
      });

      // 3. Recalculate order subtotal (remove voided item's contribution)
      const activeItems = await tx.orderItem.findMany({
        where: { orderId, status: { not: 'VOIDED' } },
      });
      const subtotal = activeItems.reduce(
        (s, i) => s + Number(i.unitPrice) * i.quantity,
        0,
      );
      await tx.order.update({
        where: { id: orderId },
        data:  { subtotal, grandTotal: subtotal },
      });

      return { complaint, message: 'Complaint filed. Item removed from bill.' };
    });
  }

  // ─── List complaints ──────────────────────────────────────────────────────

  async list(branchId: string, from?: string, to?: string, page = 1, limit = 30) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
    const toDate   = to   ? new Date(to + 'T23:59:59') : new Date();

    const [data, total] = await Promise.all([
      this.prisma.itemComplaint.findMany({
        where: {
          branchId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          order: { select: { id: true, tokenNumber: true } },
        },
      }),
      this.prisma.itemComplaint.count({
        where: { branchId, createdAt: { gte: fromDate, lte: toDate } },
      }),
    ]);

    return { data, total, page, limit };
  }

  // ─── Analytics: top offending dishes ─────────────────────────────────────

  async analytics(restaurantId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
    const toDate   = to   ? new Date(to + 'T23:59:59') : new Date();

    // 1. Total complaints in range
    const totalComplaints = await this.prisma.itemComplaint.count({
      where: { restaurantId, createdAt: { gte: fromDate, lte: toDate } },
    });

    // 2. Top dishes by complaint count
    const topDishes = await this.prisma.itemComplaint.groupBy({
      by:      ['menuItemName', 'menuItemId'],
      where:   { restaurantId, createdAt: { gte: fromDate, lte: toDate } },
      _count:  { _all: true },
      orderBy: { _count: { menuItemName: 'desc' } },
      take:    10,
    });

    // 3. Complaints by reason
    const byReason = await this.prisma.itemComplaint.groupBy({
      by:      ['reason'],
      where:   { restaurantId, createdAt: { gte: fromDate, lte: toDate } },
      _count:  { _all: true },
      orderBy: { _count: { reason: 'desc' } },
    });

    // 4. Daily trend (last 30 days bucketed by day)
    const raw = await this.prisma.itemComplaint.findMany({
      where:   { restaurantId, createdAt: { gte: fromDate, lte: toDate } },
      select:  { createdAt: true },
    });

    const trendMap: Record<string, number> = {};
    raw.forEach(({ createdAt }) => {
      const day = createdAt.toISOString().split('T')[0];
      trendMap[day] = (trendMap[day] ?? 0) + 1;
    });
    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalComplaints,
      topDishes: topDishes.map((d) => ({
        menuItemName: d.menuItemName,
        menuItemId:   d.menuItemId,
        count:        d._count._all,
      })),
      byReason: byReason.map((r) => ({
        reason: r.reason,
        count:  r._count._all,
      })),
      trend,
    };
  }

  // ─── Resolve a complaint ──────────────────────────────────────────────────

  async resolve(complaintId: string, branchId: string, dto: ResolveComplaintDto) {
    const complaint = await this.prisma.itemComplaint.findFirst({
      where: { id: complaintId, branchId },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.resolvedAt) throw new BadRequestException('Already resolved');

    return this.prisma.itemComplaint.update({
      where: { id: complaintId },
      data:  { resolvedAt: new Date(), resolution: dto.resolution },
    });
  }
}
