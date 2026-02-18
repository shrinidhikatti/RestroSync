import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRestaurantDto, SetOperatingModeDto } from './dto/restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(private prisma: PrismaService) {}

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
}
