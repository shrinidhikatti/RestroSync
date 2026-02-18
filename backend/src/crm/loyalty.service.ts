import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustLoyaltyDto, RedeemLoyaltyDto, UpdateLoyaltyConfigDto } from './dto/crm.dto';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  // ── Get config from restaurant ──────────────────────────────────────────────

  async getConfig(restaurantId: string) {
    const r = await this.prisma.restaurant.findUnique({
      where:  { id: restaurantId },
      select: { loyaltyPointsPerHundred: true, loyaltyRedeemValue: true },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return {
      loyaltyPointsPerHundred: r.loyaltyPointsPerHundred,
      loyaltyRedeemValue:      Number(r.loyaltyRedeemValue),
    };
  }

  async updateConfig(restaurantId: string, dto: UpdateLoyaltyConfigDto) {
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data:  {
        loyaltyPointsPerHundred: dto.loyaltyPointsPerHundred,
        loyaltyRedeemValue:      dto.loyaltyRedeemValue,
      },
      select: { loyaltyPointsPerHundred: true, loyaltyRedeemValue: true },
    });
  }

  // ── Points balance ──────────────────────────────────────────────────────────

  async getBalance(customerId: string) {
    const result = await this.prisma.loyaltyPoint.aggregate({
      where:  { customerId },
      _sum:   { points: true },
    });
    return result._sum.points ?? 0;
  }

  async getHistory(customerId: string) {
    return this.prisma.loyaltyPoint.findMany({
      where:   { customerId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
  }

  // ── Earn points after bill (called internally) ────────────────────────────

  async earnForOrder(restaurantId: string, customerId: string, spendAmount: number, orderId: string) {
    const { loyaltyPointsPerHundred } = await this.getConfig(restaurantId);
    const earned = Math.floor((spendAmount / 100) * loyaltyPointsPerHundred);
    if (earned <= 0) return { earned: 0 };

    await this.prisma.loyaltyPoint.create({
      data: {
        restaurantId,
        customerId,
        orderId,
        points:      earned,
        description: `Earned for order ₹${spendAmount.toFixed(2)}`,
      },
    });
    return { earned };
  }

  // ── Redeem points ─────────────────────────────────────────────────────────

  async redeem(restaurantId: string, customerId: string, dto: RedeemLoyaltyDto) {
    const balance = await this.getBalance(customerId);
    if (dto.points > balance) {
      throw new BadRequestException(`Insufficient points. Balance: ${balance}`);
    }

    const config = await this.getConfig(restaurantId);
    const discount = +(dto.points * config.loyaltyRedeemValue).toFixed(2);

    await this.prisma.loyaltyPoint.create({
      data: {
        restaurantId,
        customerId,
        orderId:     dto.orderId,
        points:      -dto.points,
        description: `Redeemed ${dto.points} pts for ₹${discount} discount`,
      },
    });

    return { redeemed: dto.points, discountValue: discount, newBalance: balance - dto.points };
  }

  // ── Manual adjustment ─────────────────────────────────────────────────────

  async adjust(restaurantId: string, customerId: string, dto: AdjustLoyaltyDto) {
    return this.prisma.loyaltyPoint.create({
      data: {
        restaurantId,
        customerId,
        orderId:     dto.orderId,
        points:      dto.points,
        description: dto.description,
      },
    });
  }

  // ── Birthday / anniversary offers (list customers with upcoming events) ────

  async getUpcomingEvents(restaurantId: string, daysAhead = 7) {
    const today  = new Date();
    const ahead  = new Date(today.getTime() + daysAhead * 86400000);
    const todayMD  = today.toISOString().slice(5, 10);   // MM-DD
    const aheadMD  = ahead.toISOString().slice(5, 10);

    // Fetch all customers with birthday or anniversary set
    const customers = await this.prisma.customer.findMany({
      where:  { restaurantId, isAnonymized: false },
      select: { id: true, name: true, phone: true, birthday: true, anniversary: true },
    });

    const events: any[] = [];
    for (const c of customers) {
      if (c.birthday) {
        const bd = c.birthday.toISOString().slice(5, 10);
        if (bd >= todayMD && bd <= aheadMD) {
          events.push({ customerId: c.id, name: c.name, phone: c.phone, event: 'BIRTHDAY', date: bd });
        }
      }
      if (c.anniversary) {
        const an = c.anniversary.toISOString().slice(5, 10);
        if (an >= todayMD && an <= aheadMD) {
          events.push({ customerId: c.id, name: c.name, phone: c.phone, event: 'ANNIVERSARY', date: an });
        }
      }
    }
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
}
