import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportTemplateDto, UpdateOnboardingProgressDto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getProgress(restaurantId: string) {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { restaurantId },
    });
    if (!progress) throw new NotFoundException('Onboarding progress not found');
    return progress;
  }

  async updateProgress(restaurantId: string, dto: UpdateOnboardingProgressDto) {
    return this.prisma.onboardingProgress.update({
      where: { restaurantId },
      data: dto,
    });
  }

  async getTemplates() {
    return this.prisma.menuTemplate.findMany({
      where: { isActive: true },
      select: { id: true, name: true, cuisine: true },
    });
  }

  async importTemplate(restaurantId: string, dto: ImportTemplateDto) {
    const template = await this.prisma.menuTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new BadRequestException({
        errorCode: 'TEMPLATE_NOT_FOUND',
        userMessage: 'Menu template not found.',
      });
    }

    const templateData = template.data as {
      categories: Array<{
        name: string;
        items: Array<{ name: string; shortName?: string; foodType?: string }>;
      }>;
    };

    // Import categories and items with placeholder prices
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < templateData.categories.length; i++) {
        const cat = templateData.categories[i];
        const category = await tx.category.create({
          data: {
            restaurantId,
            name: cat.name,
            sortOrder: i,
          },
        });

        for (let j = 0; j < cat.items.length; j++) {
          const item = cat.items[j];
          await tx.menuItem.create({
            data: {
              restaurantId,
              categoryId: category.id,
              name: item.name,
              shortName: item.shortName,
              price: 0, // Placeholder — owner must set real prices
              foodType: item.foodType || 'VEG',
              sortOrder: j,
            },
          });
        }
      }

      // Update onboarding progress
      await tx.onboardingProgress.update({
        where: { restaurantId },
        data: { menuAdded: true },
      });

      // Increment menu version
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
    });

    return { message: 'Menu template imported. Please set your prices.' };
  }
}
