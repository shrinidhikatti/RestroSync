import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { GenerateBillDto, VoidBillDto } from './dto/order.dto';

@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
  ) {}

  // ─── Next bill number ─────────────────────────────────────────────────────────

  private async nextBillNumber(branchId: string): Promise<string> {
    const now = new Date();
    const fy = now.getMonth() >= 3
      ? `${now.getFullYear()}-${now.getFullYear() + 1}`
      : `${now.getFullYear() - 1}-${now.getFullYear()}`;

    const count = await this.prisma.bill.count({
      where: { branchId, financialYear: fy },
    });
    return `INV/${fy.replace('-', '')}/${String(count + 1).padStart(5, '0')}`;
  }

  // ─── Generate bill ────────────────────────────────────────────────────────────

  async generateBill(orderId: string, branchId: string, restaurantId: string, userId: string, dto: GenerateBillDto) {
    // Check for existing unpaid bill
    const existingBill = await this.prisma.bill.findFirst({
      where: { orderId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, isVoid: false },
    });
    if (existingBill) throw new ConflictException('An unpaid bill already exists for this order');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        items: { where: { status: { not: 'VOIDED' } } },
        table: { select: { id: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'CANCELLED') throw new BadRequestException('Cannot bill a cancelled order');
    if (order.items.length === 0) throw new BadRequestException('Order has no billable items');

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { taxInclusive: true, roundingDirection: true },
    });

    // ─── Compute subtotal ──────────────────────────────────────────────────────

    let subtotal = 0;
    const itemTaxMap: { percent: number; amount: number }[] = [];

    for (const item of order.items) {
      const addonTotal = Array.isArray(item.addons)
        ? (item.addons as any[]).reduce((s: number, a: any) => s + Number(a.price), 0)
        : 0;
      const lineBase = (Number(item.unitPrice) + addonTotal) * item.quantity - Number(item.discountAmount);
      subtotal += lineBase;
      if (Number(item.taxPercent) > 0) {
        itemTaxMap.push({ percent: Number(item.taxPercent), amount: lineBase });
      }
    }

    // ─── Apply charge configs ──────────────────────────────────────────────────

    const charges = await this.prisma.chargeConfig.findMany({
      where: { restaurantId, isActive: true },
    });

    let chargesTotal = 0;
    for (const charge of charges) {
      // Check applicability
      const applicable =
        charge.applicableTo === 'ALL' ||
        (charge.applicableTo === 'DINE_IN' && order.orderType === 'DINE_IN') ||
        (charge.applicableTo === 'TAKEAWAY' && order.orderType === 'TAKEAWAY') ||
        (charge.applicableTo === 'DELIVERY' && order.orderType === 'DELIVERY');
      if (!applicable) continue;

      const chargeAmount =
        charge.type === 'PERCENTAGE'
          ? (subtotal * Number(charge.value)) / 100
          : Number(charge.value);
      chargesTotal += chargeAmount;
    }

    // ─── Apply discounts ───────────────────────────────────────────────────────

    let discountTotal = 0;
    const discountsToCreate = dto.discounts ?? [];

    for (const d of discountsToCreate) {
      const discountAmount =
        d.type === 'PERCENTAGE'
          ? ((subtotal + chargesTotal) * d.value) / 100
          : d.value;
      discountTotal += discountAmount;
    }

    // ─── Compute tax ───────────────────────────────────────────────────────────

    const taxableBase = subtotal + chargesTotal - discountTotal;
    let taxTotal = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (!restaurant?.taxInclusive) {
      // Tax-exclusive: compute tax on taxable base proportionally
      for (const { percent, amount } of itemTaxMap) {
        const itemShare = taxableBase > 0 ? (amount / subtotal) : 0;
        const taxableItemAmount = taxableBase * itemShare;
        const itemTax = (taxableItemAmount * percent) / 100;
        taxTotal += itemTax;
      }
      // Split CGST/SGST equally
      cgstAmount = taxTotal / 2;
      sgstAmount = taxTotal / 2;
    } else {
      // Tax-inclusive: tax is already in the price
      for (const { percent, amount } of itemTaxMap) {
        const taxFraction = percent / (100 + percent);
        taxTotal += amount * taxFraction;
      }
      cgstAmount = taxTotal / 2;
      sgstAmount = taxTotal / 2;
    }

    // ─── Tip ──────────────────────────────────────────────────────────────────

    const tipAmount = dto.tipAmount ?? 0;

    // ─── Grand total & rounding ────────────────────────────────────────────────

    let grandTotal = subtotal + chargesTotal - discountTotal + taxTotal + tipAmount;

    let roundOff = 0;
    const rounding = restaurant?.roundingDirection ?? 'NEAREST';
    if (rounding === 'UP') {
      const rounded = Math.ceil(grandTotal);
      roundOff = rounded - grandTotal;
      grandTotal = rounded;
    } else if (rounding === 'DOWN') {
      const rounded = Math.floor(grandTotal);
      roundOff = rounded - grandTotal;
      grandTotal = rounded;
    } else {
      const rounded = Math.round(grandTotal);
      roundOff = rounded - grandTotal;
      grandTotal = rounded;
    }

    // ─── Persist bill ──────────────────────────────────────────────────────────

    const businessDate = (() => {
      const now = new Date();
      const d = new Date(now);
      if (now.getHours() < 5) d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const now = new Date();
    const fy = now.getMonth() >= 3
      ? `${now.getFullYear()}-${now.getFullYear() + 1}`
      : `${now.getFullYear() - 1}-${now.getFullYear()}`;

    const billNumber = await this.nextBillNumber(branchId);

    const bill = await this.prisma.$transaction(async (tx) => {
      const newBill = await tx.bill.create({
        data: {
          branchId,
          orderId,
          billNumber,
          subtotal,
          discountTotal,
          chargesTotal,
          taxTotal,
          cgstAmount,
          sgstAmount,
          igstAmount,
          roundOff,
          grandTotal,
          tipAmount,
          status: 'UNPAID',
          financialYear: fy,
          businessDate,
          createdBy: userId,
        },
      });

      // Create order discount records
      for (const d of discountsToCreate) {
        const discountAmount =
          d.type === 'PERCENTAGE'
            ? ((subtotal + chargesTotal) * d.value) / 100
            : d.value;

        await tx.orderDiscount.create({
          data: {
            orderId,
            discountId: d.discountId ?? null,
            type: d.type as any,
            scope: d.scope as any,
            value: d.value,
            amount: discountAmount,
            reason: d.reason ?? null,
            couponCode: d.couponCode ?? null,
            appliedBy: userId,
            approvedBy: d.approvedBy ?? null,
          },
        });

        // Increment discount usage count
        if (d.discountId) {
          await tx.discount.update({
            where: { id: d.discountId },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Update order status to BILLED
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'BILLED',
          subtotal,
          discountTotal,
          chargesTotal,
          taxTotal,
          grandTotal,
        },
      });

      // Update table status to BILLING
      if (order.table?.id) {
        await tx.table.update({
          where: { id: order.table.id },
          data: { status: 'BILLING' },
        });
      }

      return newBill;
    });

    this.gateway.emitToBranch(branchId, 'bill:created', { billId: bill.id, orderId, grandTotal });

    return bill;
  }

  // ─── Get bill ─────────────────────────────────────────────────────────────────

  async getBill(billId: string, branchId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, branchId },
      include: {
        payments: { orderBy: { createdAt: 'asc' } },
        refunds: { include: { items: true } },
        order: {
          include: {
            items: { where: { status: { not: 'VOIDED' } }, orderBy: { createdAt: 'asc' } },
            table: { select: { number: true, section: true } },
            orderDiscounts: true,
          },
        },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  // ─── Void bill ────────────────────────────────────────────────────────────────

  async voidBill(billId: string, branchId: string, userId: string, dto: VoidBillDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, branchId },
      include: { order: { select: { id: true, tableId: true } } },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.isVoid) throw new BadRequestException('Bill is already voided');
    if (bill.status === 'PAID') throw new BadRequestException('Cannot void a paid bill');

    await this.prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id: billId },
        data: {
          isVoid: true,
          status: 'VOID',
          voidReason: dto.reason,
          voidedBy: userId,
          voidedAt: new Date(),
        },
      });

      // Record cash return if applicable
      if (dto.cashReturned && dto.verifiedBy) {
        const paymentsTotal = await tx.payment.aggregate({
          where: { billId, status: 'COMPLETED' },
          _sum: { amount: true },
        });
        const returnAmount = Number(paymentsTotal._sum.amount ?? 0);
        if (returnAmount > 0) {
          await tx.voidCashReturn.create({
            data: {
              billId,
              amount: returnAmount,
              returnedBy: userId,
              verifiedBy: dto.verifiedBy,
            },
          });
        }
      }

      // Reset order status
      await tx.order.update({
        where: { id: bill.order.id },
        data: { status: 'SERVED' },
      });

      // Reset table from BILLING to OCCUPIED
      if (bill.order.tableId) {
        await tx.table.update({
          where: { id: bill.order.tableId },
          data: { status: 'OCCUPIED' },
        });
      }
    });

    this.gateway.emitToBranch(branchId, 'bill:voided', { billId, orderId: bill.orderId });

    return { message: 'Bill voided successfully' };
  }

  // ─── Increment print count ────────────────────────────────────────────────────

  async incrementPrintCount(billId: string, branchId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, branchId } });
    if (!bill) throw new NotFoundException('Bill not found');
    return this.prisma.bill.update({ where: { id: billId }, data: { printCount: { increment: 1 } } });
  }
}
