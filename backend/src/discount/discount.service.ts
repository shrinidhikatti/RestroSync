import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
  UpdateDiscountConfigDto,
  UpdateFraudAlertConfigDto,
} from './dto/discount.dto';

@Injectable()
export class DiscountService {
  constructor(private prisma: PrismaService) {}

  // ─── Discount CRUD ────────────────────────────────────────────

  async getAll(restaurantId: string) {
    return this.prisma.discount.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(restaurantId: string, id: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, restaurantId },
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async create(restaurantId: string, dto: CreateDiscountDto, createdBy: string) {
    if (dto.code) {
      const existing = await this.prisma.discount.findFirst({
        where: { restaurantId, couponCode: dto.code.toUpperCase() },
      });
      if (existing) throw new ConflictException('Discount code already exists');
    }

    return this.prisma.discount.create({
      data: {
        restaurantId,
        name: dto.name,
        type: dto.type,
        scope: dto.scope,
        value: dto.value,
        maxDiscount: dto.maxDiscount,
        minOrderValue: dto.minOrderValue,
        maxUsagePerCustomer: dto.usageLimitPerCustomer,
        maxUsageTotal: dto.totalUsageLimit,
        startDate: dto.validFrom ? new Date(dto.validFrom) : undefined,
        endDate: dto.validTo ? new Date(dto.validTo) : undefined,
        startTime: dto.happyHourStart,
        endTime: dto.happyHourEnd,
        couponCode: dto.code ? dto.code.toUpperCase() : undefined,
        applicableTo: {
          categories: dto.applicableCategoryIds ?? [],
          items: dto.applicableItemIds ?? [],
        },
        createdBy,
      },
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateDiscountDto) {
    await this.getOne(restaurantId, id);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.maxDiscount !== undefined) data.maxDiscount = dto.maxDiscount;
    if (dto.minOrderValue !== undefined) data.minOrderValue = dto.minOrderValue;
    if (dto.usageLimitPerCustomer !== undefined) data.maxUsagePerCustomer = dto.usageLimitPerCustomer;
    if (dto.totalUsageLimit !== undefined) data.maxUsageTotal = dto.totalUsageLimit;
    if (dto.validFrom !== undefined) data.startDate = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.endDate = new Date(dto.validTo);
    if (dto.happyHourStart !== undefined) data.startTime = dto.happyHourStart;
    if (dto.happyHourEnd !== undefined) data.endTime = dto.happyHourEnd;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.applicableCategoryIds !== undefined || dto.applicableItemIds !== undefined) {
      data.applicableTo = {
        categories: dto.applicableCategoryIds ?? [],
        items: dto.applicableItemIds ?? [],
      };
    }

    return this.prisma.discount.update({ where: { id }, data });
  }

  async delete(restaurantId: string, id: string) {
    await this.getOne(restaurantId, id);
    await this.prisma.discount.delete({ where: { id } });
    return { message: 'Discount deleted' };
  }

  // ─── Validate Discount ────────────────────────────────────────

  async validate(restaurantId: string, dto: ValidateDiscountDto) {
    const discount = await this.prisma.discount.findFirst({
      where: {
        restaurantId,
        couponCode: dto.code.toUpperCase(),
        isActive: true,
      },
    });

    if (!discount) {
      throw new BadRequestException('Invalid or inactive discount code');
    }

    const now = new Date();

    // Date validity
    if (discount.startDate && now < discount.startDate) {
      throw new BadRequestException('Discount is not yet valid');
    }
    if (discount.endDate && now > discount.endDate) {
      throw new BadRequestException('Discount has expired');
    }

    // Minimum order value
    if (
      discount.minOrderValue &&
      Number(dto.orderTotal) < Number(discount.minOrderValue)
    ) {
      throw new BadRequestException(
        `Minimum order value of ₹${discount.minOrderValue} required`,
      );
    }

    // Happy hour check
    if (discount.startTime && discount.endTime) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [startH, startM] = discount.startTime.split(':').map(Number);
      const [endH, endM] = discount.endTime.split(':').map(Number);
      const currentTime = currentHour * 60 + currentMinute;
      const startTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;

      if (currentTime < startTime || currentTime > endTime) {
        throw new BadRequestException(
          `Discount is only valid between ${discount.startTime} and ${discount.endTime}`,
        );
      }
    }

    // Total usage limit
    if (discount.maxUsageTotal && discount.usageCount >= discount.maxUsageTotal) {
      throw new BadRequestException('Discount usage limit reached');
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === 'PERCENTAGE') {
      discountAmount = (Number(dto.orderTotal) * Number(discount.value)) / 100;
      if (discount.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
      }
    } else {
      discountAmount = Math.min(Number(discount.value), Number(dto.orderTotal));
    }

    return {
      discountId: discount.id,
      code: discount.couponCode,
      name: discount.name,
      type: discount.type,
      value: Number(discount.value),
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Number(dto.orderTotal) - discountAmount,
    };
  }

  // ─── Discount Config ──────────────────────────────────────────

  async getConfig(restaurantId: string) {
    return this.prisma.discountConfig.findUnique({ where: { restaurantId } });
  }

  async updateConfig(restaurantId: string, dto: UpdateDiscountConfigDto) {
    // Map DTO fields to schema fields
    const data: any = {};
    if (dto.maxBillDiscountPercent !== undefined) {
      data.maxDiscountWithoutPin = dto.maxBillDiscountPercent;
    }
    if (dto.approvalThreshold !== undefined) {
      data.maxFlatDiscountWithoutPin = dto.approvalThreshold;
    }

    return this.prisma.discountConfig.upsert({
      where: { restaurantId },
      update: data,
      create: { restaurantId, ...data },
    });
  }

  // ─── Fraud Alert Config ───────────────────────────────────────

  async getFraudConfig(restaurantId: string) {
    return this.prisma.fraudAlertConfig.findUnique({ where: { restaurantId } });
  }

  async updateFraudConfig(restaurantId: string, dto: UpdateFraudAlertConfigDto) {
    // Map DTO fields to schema fields
    const data: any = {};
    if (dto.dailyDiscountThreshold !== undefined) {
      data.maxVoidAmountPerDay = dto.dailyDiscountThreshold;
    }
    if (dto.isActive !== undefined) {
      // FraudAlertConfig doesn't have isActive, skip
    }

    return this.prisma.fraudAlertConfig.upsert({
      where: { restaurantId },
      update: data,
      create: { restaurantId, ...data },
    });
  }
}
