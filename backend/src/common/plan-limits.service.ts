import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PlanResource = 'branches' | 'devices' | 'staff' | 'menuItems';

@Injectable()
export class PlanLimitsService {
  constructor(private prisma: PrismaService) {}

  /** Throws 402 if the restaurant has reached the plan limit for the given resource. */
  async enforce(restaurantId: string, resource: PlanResource): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { plan: true },
    });
    if (!restaurant?.plan) return; // no plan assigned → no enforcement

    const plan = restaurant.plan;

    let current: number;
    let max: number;
    let label: string;

    switch (resource) {
      case 'branches':
        current = await this.prisma.branch.count({ where: { restaurantId } });
        max = plan.maxBranches;
        label = 'branches';
        break;
      case 'devices':
        current = await this.prisma.device.count({ where: { restaurantId, isActive: true } });
        max = plan.maxDevices;
        label = 'devices';
        break;
      case 'staff':
        current = await this.prisma.user.count({
          where: {
            restaurantId,
            role: { not: 'OWNER' },
            isActive: true,
          },
        });
        max = plan.maxStaff;
        label = 'staff members';
        break;
      case 'menuItems':
        current = await this.prisma.menuItem.count({
          where: { restaurantId, isArchived: false },
        });
        max = plan.maxMenuItems;
        label = 'menu items';
        break;
    }

    if (current >= max) {
      throw new HttpException(
        {
          errorCode: 'PLAN_LIMIT_EXCEEDED',
          userMessage: `Your ${plan.name} plan allows up to ${max} ${label}. Upgrade your plan to add more.`,
          current,
          max,
          resource,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
