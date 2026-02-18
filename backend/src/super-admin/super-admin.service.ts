import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantDto, ListRestaurantsQueryDto } from './dto/super-admin.dto';
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

    const result = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: dto.restaurantName,
          email: dto.ownerEmail,
          phone: dto.ownerPhone,
          city: dto.city,
          address: dto.address,
          planId: dto.planId,
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
