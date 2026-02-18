import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCreditAccountDto, UpdateCreditAccountDto,
  ChargeCreditDto, SettleCreditDto,
} from './dto/crm.dto';

@Injectable()
export class CreditService {
  constructor(private prisma: PrismaService) {}

  // ── Accounts ─────────────────────────────────────────────────────────────────

  async createAccount(restaurantId: string, dto: CreateCreditAccountDto, createdBy: string) {
    // Verify customer belongs to restaurant
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, restaurantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const existing = await this.prisma.customerCreditAccount.findUnique({
      where: { customerId: dto.customerId },
    });
    if (existing) throw new BadRequestException('Credit account already exists for this customer');

    return this.prisma.customerCreditAccount.create({
      data: {
        restaurantId,
        customerId:   dto.customerId,
        creditLimit:  dto.creditLimit ?? 5000,
        createdBy,
      },
    });
  }

  async listAccounts(restaurantId: string) {
    const accounts = await this.prisma.customerCreditAccount.findMany({
      where:   { restaurantId },
      include: {
        customer: { select: { name: true, phone: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where:   { type: 'PAYMENT' },
        },
      },
      orderBy: { currentBalance: 'desc' },
    });

    const now = new Date();
    return accounts.map((a) => {
      const lastPayment = a.transactions[0];
      const daysSincePayment = lastPayment
        ? Math.floor((now.getTime() - lastPayment.createdAt.getTime()) / 86400000)
        : null;

      return {
        ...a,
        currentBalance:   Number(a.currentBalance),
        creditLimit:      Number(a.creditLimit),
        overdue:          daysSincePayment !== null && daysSincePayment > 30,
        daysSincePayment,
        customerName:     a.customer.name,
        customerPhone:    a.customer.phone,
      };
    });
  }

  async getAccount(restaurantId: string, customerId: string) {
    const account = await this.prisma.customerCreditAccount.findFirst({
      where:   { restaurantId, customerId },
      include: {
        customer:     { select: { name: true, phone: true, email: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!account) throw new NotFoundException('Credit account not found');

    return {
      ...account,
      currentBalance: Number(account.currentBalance),
      creditLimit:    Number(account.creditLimit),
      transactions:   account.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
    };
  }

  async updateAccount(restaurantId: string, accountId: string, dto: UpdateCreditAccountDto) {
    const acc = await this.prisma.customerCreditAccount.findFirst({
      where: { id: accountId, restaurantId },
    });
    if (!acc) throw new NotFoundException('Credit account not found');
    return this.prisma.customerCreditAccount.update({
      where: { id: accountId },
      data:  dto,
    });
  }

  // ── Transactions ──────────────────────────────────────────────────────────────

  async charge(restaurantId: string, accountId: string, dto: ChargeCreditDto, createdBy: string) {
    const acc = await this.prisma.customerCreditAccount.findFirst({
      where: { id: accountId, restaurantId, isActive: true },
    });
    if (!acc) throw new NotFoundException('Active credit account not found');

    const newBalance = Number(acc.currentBalance) + dto.amount;
    if (newBalance > Number(acc.creditLimit)) {
      throw new BadRequestException(
        `Charge exceeds credit limit. Available: ₹${(Number(acc.creditLimit) - Number(acc.currentBalance)).toFixed(2)}`,
      );
    }

    return this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          creditAccountId: accountId,
          type:            'CHARGE',
          amount:          dto.amount,
          orderId:         dto.orderId,
          notes:           dto.notes,
          createdBy,
        },
      }),
      this.prisma.customerCreditAccount.update({
        where: { id: accountId },
        data:  { currentBalance: { increment: dto.amount } },
      }),
    ]);
  }

  async settle(restaurantId: string, accountId: string, dto: SettleCreditDto, createdBy: string) {
    const acc = await this.prisma.customerCreditAccount.findFirst({
      where: { id: accountId, restaurantId, isActive: true },
    });
    if (!acc) throw new NotFoundException('Active credit account not found');

    if (dto.amount > Number(acc.currentBalance)) {
      throw new BadRequestException(
        `Settlement amount exceeds balance. Outstanding: ₹${Number(acc.currentBalance).toFixed(2)}`,
      );
    }

    return this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          creditAccountId: accountId,
          type:            'PAYMENT',
          amount:          dto.amount,
          paymentMethod:   dto.paymentMethod,
          notes:           dto.notes,
          createdBy,
        },
      }),
      this.prisma.customerCreditAccount.update({
        where: { id: accountId },
        data:  { currentBalance: { decrement: dto.amount } },
      }),
    ]);
  }

  // ── Credit aging report ────────────────────────────────────────────────────

  async agingReport(restaurantId: string) {
    const accounts = await this.listAccounts(restaurantId);
    const withBalance = accounts.filter((a) => a.currentBalance > 0);

    const buckets = {
      current:   withBalance.filter((a) => !a.daysSincePayment || a.daysSincePayment <= 30),
      overdue30: withBalance.filter((a) => a.daysSincePayment && a.daysSincePayment > 30 && a.daysSincePayment <= 60),
      overdue60: withBalance.filter((a) => a.daysSincePayment && a.daysSincePayment > 60),
    };

    return {
      totalOutstanding: +withBalance.reduce((s, a) => s + a.currentBalance, 0).toFixed(2),
      current:   { count: buckets.current.length,   total: +buckets.current.reduce((s, a) => s + a.currentBalance, 0).toFixed(2) },
      overdue30: { count: buckets.overdue30.length, total: +buckets.overdue30.reduce((s, a) => s + a.currentBalance, 0).toFixed(2) },
      overdue60: { count: buckets.overdue60.length, total: +buckets.overdue60.reduce((s, a) => s + a.currentBalance, 0).toFixed(2) },
      accounts:  withBalance,
    };
  }
}
