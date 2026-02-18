import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { RecordPaymentDto, CreateRefundDto, UpdateRefundStatusDto } from './dto/order.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
  ) {}

  // ─── Record payment ───────────────────────────────────────────────────────────

  async recordPayment(billId: string, branchId: string, userId: string, dto: RecordPaymentDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, branchId },
      include: {
        order: { select: { id: true, tableId: true } },
        payments: { where: { status: 'COMPLETED' } },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.isVoid) throw new BadRequestException('Bill is voided');
    if (bill.status === 'PAID') throw new BadRequestException('Bill is already paid');

    // Compute total already paid
    const alreadyPaid = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
    const newPaymentTotal = dto.payments.reduce((s, p) => s + p.amount, 0);
    const totalPaid = alreadyPaid + newPaymentTotal;
    const grandTotal = Number(bill.grandTotal);

    if (totalPaid > grandTotal + 0.01) {
      throw new BadRequestException(
        `Payment total (${totalPaid}) exceeds bill amount (${grandTotal})`,
      );
    }

    const isFullyPaid = totalPaid >= grandTotal - 0.01;

    await this.prisma.$transaction(async (tx) => {
      // Create payment records
      for (const p of dto.payments) {
        await tx.payment.create({
          data: {
            billId,
            orderId: bill.orderId,
            method: p.method as any,
            amount: p.amount,
            status: 'COMPLETED',
            reference: p.reference ?? null,
            splitLabel: p.splitLabel ?? null,
            createdBy: userId,
          },
        });
      }

      // Update bill status
      await tx.bill.update({
        where: { id: billId },
        data: { status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID' },
      });

      if (isFullyPaid) {
        // Mark order as COMPLETED
        await tx.order.update({
          where: { id: bill.order.id },
          data: { status: 'COMPLETED' },
        });

        // Free the table
        if (bill.order.tableId) {
          await tx.table.update({
            where: { id: bill.order.tableId },
            data: { status: 'AVAILABLE', occupiedSince: null },
          });
        }
      }
    });

    this.gateway.emitToBranch(branchId, 'payment:recorded', {
      billId,
      orderId: bill.orderId,
      isFullyPaid,
      totalPaid,
    });

    return { message: isFullyPaid ? 'Payment complete' : 'Partial payment recorded', totalPaid, isFullyPaid };
  }

  // ─── Create refund ────────────────────────────────────────────────────────────

  async createRefund(billId: string, branchId: string, userId: string, dto: CreateRefundDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, branchId },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status !== 'PAID') throw new BadRequestException('Can only refund a paid bill');

    // Validate refund amount
    const existingRefunds = await this.prisma.refund.aggregate({
      where: { billId, status: { not: 'REJECTED' } },
      _sum: { amount: true },
    });
    const alreadyRefunded = Number(existingRefunds._sum.amount ?? 0);
    if (alreadyRefunded + dto.amount > Number(bill.grandTotal)) {
      throw new BadRequestException('Refund exceeds bill amount');
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const newRefund = await tx.refund.create({
        data: {
          billId,
          orderId: bill.orderId,
          type: dto.type as any,
          amount: dto.amount,
          reason: dto.reason,
          refundMethod: dto.refundMethod,
          approvedBy: userId, // Self-approved at creation; can be updated by manager
          createdBy: userId,
          status: 'PENDING',
          notes: null,
        },
      });

      // Create refund items if partial
      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await tx.refundItem.create({
            data: {
              refundId: newRefund.id,
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              amount: item.amount,
              reason: item.reason ?? null,
            },
          });
        }
      }

      return newRefund;
    });

    return refund;
  }

  // ─── List refunds ─────────────────────────────────────────────────────────────

  async getRefunds(billId: string, branchId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, branchId } });
    if (!bill) throw new NotFoundException('Bill not found');

    return this.prisma.refund.findMany({
      where: { billId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { orderItem: { select: { itemName: true, unitPrice: true } } } } },
    });
  }

  // ─── Update refund status ─────────────────────────────────────────────────────

  async updateRefundStatus(refundId: string, branchId: string, userId: string, dto: UpdateRefundStatusDto) {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId },
      include: { bill: { select: { branchId: true } } },
    });
    if (!refund || refund.bill.branchId !== branchId) throw new NotFoundException('Refund not found');
    if (refund.status === 'COMPLETED' || refund.status === 'REJECTED') {
      throw new BadRequestException('Refund is already finalized');
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: dto.status as any,
        approvedBy: dto.status === 'APPROVED' || dto.status === 'COMPLETED' ? userId : refund.approvedBy,
        notes: dto.notes ?? refund.notes,
      },
    });

    return updated;
  }

  // ─── Get payments for bill ────────────────────────────────────────────────────

  async getPayments(billId: string, branchId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, branchId } });
    if (!bill) throw new NotFoundException('Bill not found');

    const payments = await this.prisma.payment.findMany({
      where: { billId },
      orderBy: { createdAt: 'asc' },
    });

    const summary = {
      total: payments.reduce((s, p) => s + Number(p.amount), 0),
      byMethod: payments.reduce(
        (acc, p) => {
          acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    return { payments, summary };
  }
}
