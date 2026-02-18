import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/crm.dto';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  // ── Upsert customer by phone (used at billing) ───────────────────────────────

  async upsertByPhone(restaurantId: string, phone: string, name?: string) {
    return this.prisma.customer.upsert({
      where:  { phone_restaurantId: { phone, restaurantId } },
      create: { restaurantId, phone, name },
      update: name ? { name } : {},
    });
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(restaurantId: string, dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { phone_restaurantId: { phone: dto.phone, restaurantId } },
    });
    if (existing) throw new ConflictException('Customer with this phone already exists');

    return this.prisma.customer.create({
      data: {
        ...dto,
        restaurantId,
        birthday:    dto.birthday    ? new Date(dto.birthday)    : undefined,
        anniversary: dto.anniversary ? new Date(dto.anniversary) : undefined,
        consentDate: dto.consentGiven ? new Date() : undefined,
      },
    });
  }

  async findAll(restaurantId: string, opts: {
    search?: string; tag?: string; page?: number; limit?: number;
  }) {
    const page  = opts.page  ?? 1;
    const limit = opts.limit ?? 30;
    const skip  = (page - 1) * limit;

    const where: any = { restaurantId, isAnonymized: false };
    if (opts.tag)    where.tags    = { contains: opts.tag, mode: 'insensitive' };
    if (opts.search) {
      where.OR = [
        { name:  { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search } },
        { email: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { totalSpend: 'desc' },
        include: {
          creditAccount: { select: { currentBalance: true, isActive: true } },
          loyaltyPoints: { select: { points: true } },
        },
      }),
    ]);

    const customers = data.map((c) => ({
      ...c,
      totalLoyaltyPoints: c.loyaltyPoints.reduce((s, l) => s + l.points, 0),
      creditBalance: c.creditAccount ? Number(c.creditAccount.currentBalance) : null,
    }));

    return { data: customers, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(restaurantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, restaurantId, isAnonymized: false },
      include: {
        creditAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        loyaltyPoints: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!c) throw new NotFoundException('Customer not found');

    const orders = await this.prisma.order.findMany({
      where:   { branch: { restaurantId: c.restaurantId }, customerPhone: c.phone },
      include: { bills: { include: { payments: true } } },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    return {
      ...c,
      totalLoyaltyPoints: c.loyaltyPoints.reduce((s, l) => s + l.points, 0),
      recentOrders: orders,
    };
  }

  async update(restaurantId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(restaurantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        birthday:    dto.birthday    ? new Date(dto.birthday)    : undefined,
        anniversary: dto.anniversary ? new Date(dto.anniversary) : undefined,
        consentDate: dto.consentGiven ? new Date() : undefined,
      },
    });
  }

  async anonymize(restaurantId: string, id: string) {
    await this.findOne(restaurantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        isAnonymized: true,
        name:  null,
        phone: `ANON-${id.slice(0, 8)}`,
        email: null,
        birthday:    null,
        anniversary: null,
        notes: null,
        tags:  null,
      },
    });
  }

  // ── Stats on existing customer after bill ──────────────────────────────────

  async updateStats(customerId: string, spendAmount: number) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data:  {
        totalOrders: { increment: 1 },
        totalSpend:  { increment: spendAmount },
        lastVisit:   new Date(),
      },
    });
  }

  // ── Segmentation ────────────────────────────────────────────────────────────

  async getSegments(restaurantId: string) {
    const [total, vip, regular, newCount] = await Promise.all([
      this.prisma.customer.count({ where: { restaurantId, isAnonymized: false } }),
      this.prisma.customer.count({ where: { restaurantId, isAnonymized: false, tags: { contains: 'VIP' } } }),
      this.prisma.customer.count({ where: { restaurantId, isAnonymized: false, totalOrders: { gte: 5 } } }),
      this.prisma.customer.count({ where: { restaurantId, isAnonymized: false, totalOrders: 1 } }),
    ]);
    return { total, vip, regular, newCustomers: newCount };
  }
}
