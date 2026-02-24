import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantDto, ListRestaurantsQueryDto } from './dto/super-admin.dto';
import { MODULE_DEFAULTS } from '../common/modules.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  async listRestaurants(query: ListRestaurantsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RestaurantWhereInput = {};

    if (query.status) {
      where.status = query.status as any;
    }
    if (query.mode) {
      where.operatingMode = query.mode as any;
    }
    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branches: { select: { id: true, name: true } },
          users: {
            where: { role: 'OWNER' },
            select: { name: true, phone: true, email: true, lastLogin: true },
            take: 1,
          },
          plan: { select: { name: true } },
          _count: { select: { branches: true, users: true } },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data: restaurants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRestaurantDetail(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        branches: true,
        users: {
          select: { id: true, name: true, role: true, phone: true, email: true, lastLogin: true, isActive: true },
        },
        plan: true,
        _count: { select: { branches: true, users: true } },
      },
    });

    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // Get basic stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayOrders, totalOrders] = await Promise.all([
      this.prisma.order.count({
        where: {
          branch: { restaurantId },
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.order.count({
        where: { branch: { restaurantId } },
      }),
    ]);

    return {
      ...restaurant,
      stats: { todayOrders, totalOrders },
    };
  }

  async createRestaurant(dto: CreateRestaurantDto) {
    // Check if owner email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: 'EMAIL_EXISTS',
        userMessage: 'An account with this email already exists.',
      });
    }

    // Generate temp password
    const tempPassword = uuidv4().slice(0, 12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const mode = dto.operatingMode ?? 'FULL_SERVICE';
    const enabledModules =
      dto.enabledModules?.length
        ? dto.enabledModules
        : MODULE_DEFAULTS[mode] ?? MODULE_DEFAULTS['FULL_SERVICE'];

    const result = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: dto.restaurantName,
          email: dto.ownerEmail,
          phone: dto.ownerPhone,
          city: dto.city,
          address: dto.address,
          planId: dto.planId,
          operatingMode: mode as any,
          enabledModules,
          activeModules: enabledModules,
        },
      });

      const branch = await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Branch',
          address: dto.address,
        },
      });

      const owner = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          name: dto.ownerName,
          email: dto.ownerEmail,
          phone: dto.ownerPhone,
          password: hashedPassword,
          role: 'OWNER',
          mustChangePassword: true,
        },
      });

      await tx.onboardingProgress.create({
        data: { restaurantId: restaurant.id },
      });

      return { restaurant, branch, owner };
    });

    // TODO: Send SMS/email with temp credentials to owner

    return {
      restaurant: result.restaurant,
      owner: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
        tempPassword, // Return to Super Admin so they can share manually
      },
      message: 'Restaurant created. Owner must change password on first login.',
    };
  }

  async suspendRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'SUSPENDED' },
    });
  }

  async activateRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'ACTIVE' },
    });
  }

  async softDeleteRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'DELETED' },
    });
  }

  async updateOperatingMode(restaurantId: string, mode: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { operatingMode: mode as any },
      select: { id: true, name: true, operatingMode: true },
    });
  }

  async updateEnabledModules(restaurantId: string, modules: string[]) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    // activeModules = keep whatever owner had active, but only within new granted set
    // Also add any newly granted modules (auto-activate them)
    const prevActive = restaurant.activeModules.length > 0
      ? restaurant.activeModules
      : restaurant.enabledModules;
    const newlyGranted = modules.filter((m) => !restaurant.enabledModules.includes(m));
    const activeModules = [
      ...prevActive.filter((m) => modules.includes(m)), // keep still-granted
      ...newlyGranted,                                   // auto-add new grants
    ];

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { enabledModules: modules, activeModules },
      select: { id: true, name: true, enabledModules: true, activeModules: true, operatingMode: true },
    });
  }

  async updatePlan(restaurantId: string, planId: string) {
    const [restaurant, plan] = await Promise.all([
      this.prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      this.prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { planId },
      select: { id: true, name: true, planId: true, plan: { select: { name: true } } },
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async getPlatformStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      todayOrders,
    ] = await Promise.all([
      this.prisma.restaurant.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.restaurant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.restaurant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    return {
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      todayOrders,
    };
  }
}
