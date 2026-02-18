import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private dateRange(from: string, to: string) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // ── 7.1a  Daily sales summary ─────────────────────────────────────────────────

  async dailySummary(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const bills = await this.prisma.bill.findMany({
      where: {
        branchId,
        status: { in: ['PAID'] },
        isVoid: false,
        createdAt: { gte: start, lte: end },
      },
      include: {
        payments: { where: { status: 'COMPLETED' } },
        refunds:  { where: { status: { in: ['APPROVED', 'COMPLETED'] } } },
      },
    });

    const voided = await this.prisma.bill.count({
      where: { branchId, isVoid: true, createdAt: { gte: start, lte: end } },
    });

    const voidedAmount = await this.prisma.bill.aggregate({
      where: { branchId, isVoid: true, createdAt: { gte: start, lte: end } },
      _sum: { grandTotal: true },
    });

    const orders = await this.prisma.order.count({
      where: {
        branchId,
        status: { in: ['COMPLETED', 'BILLED'] },
        createdAt: { gte: start, lte: end },
      },
    });

    const cancelledOrders = await this.prisma.order.count({
      where: {
        branchId,
        status: 'CANCELLED',
        createdAt: { gte: start, lte: end },
      },
    });

    let totalSales = 0, cashCollected = 0, cardCollected = 0,
        upiCollected = 0, otherCollected = 0, totalRefunds = 0,
        totalDiscounts = 0, cgst = 0, sgst = 0, igst = 0;

    for (const bill of bills) {
      totalSales    += Number(bill.grandTotal);
      totalDiscounts += Number(bill.discountTotal);
      cgst          += Number(bill.cgstAmount);
      sgst          += Number(bill.sgstAmount);
      igst          += Number(bill.igstAmount);

      for (const p of bill.payments) {
        const amt = Number(p.amount);
        if (p.method === 'CASH')  cashCollected  += amt;
        else if (p.method === 'CARD') cardCollected  += amt;
        else if (p.method === 'UPI')  upiCollected   += amt;
        else                          otherCollected += amt;
      }

      for (const r of bill.refunds) {
        totalRefunds += Number(r.amount);
      }
    }

    const netSales = totalSales - totalRefunds;
    const avgOrderValue = orders > 0 ? netSales / orders : 0;

    return {
      period:         { from, to },
      totalSales:     +totalSales.toFixed(2),
      netSales:       +netSales.toFixed(2),
      totalOrders:    orders,
      cancelledOrders,
      avgOrderValue:  +avgOrderValue.toFixed(2),
      totalDiscounts: +totalDiscounts.toFixed(2),
      totalRefunds:   +totalRefunds.toFixed(2),
      voidedBills:    voided,
      voidedAmount:   +(Number(voidedAmount._sum.grandTotal) || 0).toFixed(2),
      payments: {
        cash:  +cashCollected.toFixed(2),
        card:  +cardCollected.toFixed(2),
        upi:   +upiCollected.toFixed(2),
        other: +otherCollected.toFixed(2),
      },
      tax: {
        cgst: +cgst.toFixed(2),
        sgst: +sgst.toFixed(2),
        igst: +igst.toFixed(2),
        total: +(cgst + sgst + igst).toFixed(2),
      },
    };
  }

  // ── 7.1b  Hourly sales pattern ───────────────────────────────────────────────

  async hourlySales(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const bills = await this.prisma.bill.findMany({
      where: {
        branchId,
        status: 'PAID',
        isVoid: false,
        createdAt: { gte: start, lte: end },
      },
      select: { grandTotal: true, createdAt: true },
    });

    // Aggregate by hour
    const buckets: Record<number, { orders: number; sales: number }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { orders: 0, sales: 0 };

    for (const b of bills) {
      const hour = b.createdAt.getHours();
      buckets[hour].orders++;
      buckets[hour].sales += Number(b.grandTotal);
    }

    return Object.entries(buckets).map(([hour, data]) => ({
      hour:   parseInt(hour),
      label:  `${hour.toString().padStart(2, '0')}:00`,
      orders: data.orders,
      sales:  +data.sales.toFixed(2),
    }));
  }

  // ── 7.1c  Item-wise sales ─────────────────────────────────────────────────────

  async itemSales(branchId: string, from: string, to: string, limit = 20) {
    const { start, end } = this.dateRange(from, to);

    const items = await this.prisma.orderItem.groupBy({
      by: ['itemName', 'variantName'],
      where: {
        order: {
          branchId,
          status: { in: ['COMPLETED', 'BILLED'] },
          createdAt: { gte: start, lte: end },
        },
        status: { not: 'VOIDED' },
      },
      _sum:   { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return items.map((i) => ({
      itemName:    i.itemName,
      variantName: i.variantName,
      totalQty:    i._sum.quantity ?? 0,
      orderCount:  i._count.id,
    }));
  }

  // ── 7.1d  Payment mode breakdown (for date range) ────────────────────────────

  async paymentBreakdown(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        bill: { branchId, isVoid: false },
        status: 'COMPLETED',
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

  // ── 7.1e  Daily trend (for chart — one row per business date) ─────────────────

  async dailyTrend(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const bills = await this.prisma.bill.findMany({
      where: {
        branchId,
        status: 'PAID',
        isVoid: false,
        createdAt: { gte: start, lte: end },
      },
      select: {
        grandTotal:   true,
        businessDate: true,
        createdAt:    true,
      },
    });

    const daily: Record<string, { sales: number; orders: number }> = {};
    for (const b of bills) {
      const key = (b.businessDate ?? b.createdAt).toISOString().split('T')[0];
      if (!daily[key]) daily[key] = { sales: 0, orders: 0 };
      daily[key].sales  += Number(b.grandTotal);
      daily[key].orders += 1;
    }

    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        sales:  +data.sales.toFixed(2),
        orders: data.orders,
      }));
  }

  // ── 7.1f  GST / Tax report ─────────────────────────────────────────────────────

  async taxReport(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const agg = await this.prisma.bill.aggregate({
      where: {
        branchId,
        status: 'PAID',
        isVoid: false,
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        subtotal:     true,
        discountTotal: true,
        chargesTotal:  true,
        taxTotal:      true,
        cgstAmount:    true,
        sgstAmount:    true,
        igstAmount:    true,
        grandTotal:    true,
      },
      _count: { id: true },
    });

    const s = agg._sum;
    return {
      period:       { from, to },
      billCount:    agg._count.id,
      subtotal:     +(Number(s.subtotal)     || 0).toFixed(2),
      discounts:    +(Number(s.discountTotal) || 0).toFixed(2),
      charges:      +(Number(s.chargesTotal)  || 0).toFixed(2),
      taxTotal:     +(Number(s.taxTotal)      || 0).toFixed(2),
      cgst:         +(Number(s.cgstAmount)    || 0).toFixed(2),
      sgst:         +(Number(s.sgstAmount)    || 0).toFixed(2),
      igst:         +(Number(s.igstAmount)    || 0).toFixed(2),
      grandTotal:   +(Number(s.grandTotal)    || 0).toFixed(2),
    };
  }

  // ── 7.4  Void / cancel report ─────────────────────────────────────────────────

  async voidReport(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const voidedBills = await this.prisma.bill.findMany({
      where: {
        branchId,
        isVoid: true,
        voidedAt: { gte: start, lte: end },
      },
      include: {
        order: {
          select: { orderType: true, tableId: true, customerName: true },
        },
        voidCashReturn: true,
      },
      orderBy: { voidedAt: 'desc' },
    });

    const cancelledOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: 'CANCELLED',
        updatedAt: { gte: start, lte: end },
      },
      select: {
        id: true, orderType: true, cancelReason: true,
        cancelledBy: true, createdAt: true, updatedAt: true,
        grandTotal: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      voidedBills:  voidedBills.map((b) => ({
        billId:           b.id,
        billNumber:       b.billNumber,
        grandTotal:       Number(b.grandTotal),
        voidReason:       b.voidReason,
        voidedBy:         b.voidedBy,
        voidedAt:         b.voidedAt,
        cashReturnAmount: b.voidCashReturn ? Number(b.voidCashReturn.amount) : null,
        orderType:        b.order?.orderType,
      })),
      cancelledOrders,
      summary: {
        voidCount:       voidedBills.length,
        voidAmount:      +voidedBills.reduce((s, b) => s + Number(b.grandTotal), 0).toFixed(2),
        cashReturned:    +voidedBills.reduce(
          (s, b) => s + (b.voidCashReturn ? Number(b.voidCashReturn.amount) : 0), 0
        ).toFixed(2),
        cancelCount:     cancelledOrders.length,
        cancelAmount:    +cancelledOrders.reduce((s, o) => s + Number(o.grandTotal), 0).toFixed(2),
      },
    };
  }

  // ── 7.4  Discount report (biller-wise) ───────────────────────────────────────

  async discountReport(branchId: string, from: string, to: string) {
    const { start, end } = this.dateRange(from, to);

    const discounts = await this.prisma.orderDiscount.findMany({
      where: {
        order: { branchId, createdAt: { gte: start, lte: end } },
      },
      include: {
        order: { select: { orderType: true, createdAt: true } },
      },
    });

    // Group by appliedBy
    const byBiller: Record<string, { count: number; total: number; orderIds: Set<string> }> = {};
    for (const d of discounts) {
      if (!byBiller[d.appliedBy]) {
        byBiller[d.appliedBy] = { count: 0, total: 0, orderIds: new Set() };
      }
      byBiller[d.appliedBy].count++;
      byBiller[d.appliedBy].total += Number(d.amount);
      byBiller[d.appliedBy].orderIds.add(d.orderId);
    }

    const totalOrders = await this.prisma.order.count({
      where: {
        branchId,
        status: { in: ['COMPLETED', 'BILLED', 'CANCELLED'] },
        createdAt: { gte: start, lte: end },
      },
    });

    return {
      byBiller: Object.entries(byBiller).map(([userId, data]) => ({
        userId,
        discountCount:  data.count,
        totalAmount:    +data.total.toFixed(2),
        affectedOrders: data.orderIds.size,
        pctOfOrders:    totalOrders > 0
          ? +((data.orderIds.size / totalOrders) * 100).toFixed(1)
          : 0,
      })).sort((a, b) => b.totalAmount - a.totalAmount),
      totals: {
        discountCount:  discounts.length,
        totalAmount:    +discounts.reduce((s, d) => s + Number(d.amount), 0).toFixed(2),
        affectedOrders: new Set(discounts.map((d) => d.orderId)).size,
        totalOrders,
      },
    };
  }

  // ── Pre-compute daily report ─────────────────────────────────────────────────

  async computeDailyReport(branchId: string, businessDate: string) {
    const summary = await this.dailySummary(branchId, businessDate, businessDate);

    await this.prisma.dailyReport.upsert({
      where:  { branchId_businessDate: { branchId, businessDate: new Date(businessDate) } },
      create: {
        branchId,
        businessDate:     new Date(businessDate),
        totalSales:       summary.totalSales,
        totalOrders:      summary.totalOrders,
        averageOrderValue: summary.avgOrderValue,
        cashCollected:    summary.payments.cash,
        cardCollected:    summary.payments.card,
        upiCollected:     summary.payments.upi,
        totalDiscounts:   summary.totalDiscounts,
        totalRefunds:     summary.totalRefunds,
        totalVoids:       summary.voidedAmount,
        netSales:         summary.netSales,
      },
      update: {
        totalSales:       summary.totalSales,
        totalOrders:      summary.totalOrders,
        averageOrderValue: summary.avgOrderValue,
        cashCollected:    summary.payments.cash,
        cardCollected:    summary.payments.card,
        upiCollected:     summary.payments.upi,
        totalDiscounts:   summary.totalDiscounts,
        totalRefunds:     summary.totalRefunds,
        totalVoids:       summary.voidedAmount,
        netSales:         summary.netSales,
      },
    });

    return { computed: true, businessDate, branchId };
  }
}
