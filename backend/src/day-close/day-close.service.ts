import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Orders that are still "open" (not yet billed/completed/cancelled)
const OPEN_STATUSES: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

@Injectable()
export class DayCloseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Business date (same logic as OrderService) ───────────────────────────

  private getBusinessDate(): Date {
    const now = new Date();
    const businessDate = new Date(now);
    if (now.getHours() < 5) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setHours(0, 0, 0, 0);
    return businessDate;
  }

  // ─── Get current day-close status ─────────────────────────────────────────

  async getStatus(branchId: string) {
    const businessDate = this.getBusinessDate();
    const lock = await this.prisma.dayCloseLock.findUnique({
      where: { branchId_businessDate: { branchId, businessDate } },
    });
    return {
      businessDate: businessDate.toISOString().split('T')[0],
      status: lock?.status ?? null,
      startedAt: lock?.startedAt ?? null,
      completedAt: lock?.completedAt ?? null,
      isLocked: lock !== null,
    };
  }

  // ─── Get unbilled orders ───────────────────────────────────────────────────

  async getUnbilledOrders(branchId: string) {
    const businessDate = this.getBusinessDate();
    const start = new Date(businessDate);
    const end = new Date(businessDate);
    end.setDate(end.getDate() + 1);

    const unbilled = await this.prisma.order.findMany({
      where: {
        branchId,
        businessDate: { gte: start, lt: end },
        status: { in: OPEN_STATUSES },
      },
      include: {
        table: { select: { number: true } },
        items: {
          where: { status: { not: 'VOIDED' } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      count: unbilled.length,
      orders: unbilled.map((o) => ({
        id: o.id,
        tokenNumber: o.tokenNumber,
        tableNumber: o.table?.number ?? null,
        orderType: o.orderType,
        status: o.status,
        itemCount: o.items.length,
        createdAt: o.createdAt,
      })),
    };
  }

  // ─── Initiate day close ────────────────────────────────────────────────────

  async initiate(branchId: string, userId: string) {
    const businessDate = this.getBusinessDate();

    // Check if already locked
    const existing = await this.prisma.dayCloseLock.findUnique({
      where: { branchId_businessDate: { branchId, businessDate } },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: 'DAY_CLOSE_ALREADY_INITIATED',
        userMessage: `Day close for ${businessDate.toISOString().split('T')[0]} is already ${existing.status}.`,
      });
    }

    // Check for unbilled orders
    const unbilled = await this.getUnbilledOrders(branchId);
    if (unbilled.count > 0) {
      throw new BadRequestException({
        errorCode: 'UNBILLED_ORDERS_EXIST',
        userMessage: `Cannot close day: ${unbilled.count} order(s) are still open. Bill them or carry forward first.`,
        details: { count: unbilled.count, orders: unbilled.orders },
      });
    }

    const lock = await this.prisma.dayCloseLock.create({
      data: {
        branchId,
        businessDate,
        status: 'IN_PROGRESS',
        initiatedBy: userId,
      },
    });

    return {
      message: 'Day close initiated. Submit cash reconciliation to complete.',
      lock: {
        id: lock.id,
        businessDate: businessDate.toISOString().split('T')[0],
        status: lock.status,
        startedAt: lock.startedAt,
      },
    };
  }

  // ─── Carry forward open orders ─────────────────────────────────────────────
  // Called when the manager wants to move open orders to next business day
  // without requiring them to be billed first.

  async carryForward(branchId: string, userId: string) {
    const businessDate = this.getBusinessDate();
    const start = new Date(businessDate);
    const end = new Date(businessDate);
    end.setDate(end.getDate() + 1);

    // Next business date
    const nextBusinessDate = new Date(businessDate);
    nextBusinessDate.setDate(nextBusinessDate.getDate() + 1);

    const openOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        businessDate: { gte: start, lt: end },
        status: { in: OPEN_STATUSES },
      },
      select: { id: true, tokenNumber: true },
    });

    if (openOrders.length === 0) {
      return { message: 'No open orders to carry forward.', count: 0 };
    }

    await this.prisma.order.updateMany({
      where: { id: { in: openOrders.map((o) => o.id) } },
      data: { businessDate: nextBusinessDate },
    });

    return {
      message: `${openOrders.length} order(s) carried forward to ${nextBusinessDate.toISOString().split('T')[0]}.`,
      count: openOrders.length,
      nextBusinessDate: nextBusinessDate.toISOString().split('T')[0],
    };
  }

  // ─── Submit cash reconciliation + complete day ─────────────────────────────

  async complete(
    branchId: string,
    userId: string,
    dto: { cashInDrawer: number; notes?: string },
  ) {
    const businessDate = this.getBusinessDate();

    const lock = await this.prisma.dayCloseLock.findUnique({
      where: { branchId_businessDate: { branchId, businessDate } },
    });

    if (!lock) {
      throw new NotFoundException({
        errorCode: 'DAY_CLOSE_NOT_INITIATED',
        userMessage: 'Day close has not been initiated yet. Call initiate first.',
      });
    }

    if (lock.status === 'COMPLETED') {
      throw new ConflictException({
        errorCode: 'DAY_CLOSE_ALREADY_COMPLETED',
        userMessage: 'Day close is already completed.',
      });
    }

    // Compute expected cash from payments
    const start = new Date(businessDate);
    const end = new Date(businessDate);
    end.setDate(end.getDate() + 1);

    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        bill: { order: { branchId, businessDate: { gte: start, lt: end } } },
        method: 'CASH',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });

    const expectedCash = Number(cashPayments._sum.amount ?? 0);
    const actualCash = dto.cashInDrawer;
    const variance = actualCash - expectedCash;

    // Mark lock as completed
    const updatedLock = await this.prisma.dayCloseLock.update({
      where: { id: lock.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return {
      message: 'Day close completed successfully.',
      businessDate: businessDate.toISOString().split('T')[0],
      reconciliation: {
        expectedCash: Number(expectedCash.toFixed(2)),
        actualCash: Number(actualCash.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        notes: dto.notes ?? null,
      },
      completedAt: updatedLock.completedAt,
    };
  }
}
