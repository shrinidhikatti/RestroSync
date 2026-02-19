import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../common/plan-limits.service';
import { UpdateRestaurantDto, SetOperatingModeDto, CreateStaffDto } from './dto/restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    private prisma: PrismaService,
    private planLimits: PlanLimitsService,
  ) {}

  async getMyRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        branches: { where: { isActive: true } },
        plan: true,
        onboardingProgress: true,
      },
    });

    if (!restaurant) throw new NotFoundException();

    // Add FSSAI warning if not set
    const warnings: string[] = [];
    if (!restaurant.fssaiNumber) {
      warnings.push('FSSAI number is required by law on every bill. Please add it in Settings.');
    }

    return { ...restaurant, warnings };
  }

  async updateRestaurant(restaurantId: string, dto: UpdateRestaurantDto) {
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: dto,
    });
  }

  async setOperatingMode(restaurantId: string, dto: SetOperatingModeDto) {
    const restaurant = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { operatingMode: dto.operatingMode },
    });

    // Update onboarding progress
    await this.prisma.onboardingProgress.updateMany({
      where: { restaurantId },
      data: { modeSelected: true },
    });

    return restaurant;
  }

  // ─── Staff Management ─────────────────────────────────────────────────────

  async listStaff(restaurantId: string) {
    return this.prisma.user.findMany({
      where: { restaurantId, role: { not: 'OWNER' } },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        branchId: true, isActive: true, lastLogin: true, createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(restaurantId: string, dto: CreateStaffDto) {
    await this.planLimits.enforce(restaurantId, 'staff');

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, restaurantId },
    });
    if (existing) throw new ConflictException('Email already in use within this restaurant');

    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        restaurantId,
        name:              dto.name,
        email:             dto.email,
        password:          hashed,
        role:              dto.role,
        branchId:          dto.branchId,
        phone:             dto.phone,
        mustChangePassword: true,
      },
      select: {
        id: true, name: true, email: true, role: true, branchId: true,
        isActive: true, mustChangePassword: true, createdAt: true,
      },
    });
  }

  async deactivateStaff(restaurantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, restaurantId, role: { not: 'OWNER' } },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }
}
