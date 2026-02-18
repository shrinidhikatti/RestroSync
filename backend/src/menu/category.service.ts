import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto/menu.dto';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  async getAll(restaurantId: string) {
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { menuItems: { where: { isArchived: false } } } },
      },
    });
  }

  async getOne(restaurantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, restaurantId },
      include: {
        menuItems: {
          where: { isArchived: false },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { variants: true, addons: true, taxGroup: true },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(restaurantId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { restaurantId, name: dto.name },
    });
    if (existing) throw new ConflictException('Category with this name already exists');

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { restaurantId, ...dto },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return category;
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateCategoryDto) {
    await this.getOne(restaurantId, id);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: dto,
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return category;
    });
  }

  async remove(restaurantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, restaurantId },
      include: { _count: { select: { menuItems: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category._count.menuItems > 0) {
      // Soft-delete instead of hard delete to preserve history
      return this.update(restaurantId, id, { isActive: false });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return { message: 'Category deleted' };
    });
  }

  async reorder(restaurantId: string, dto: ReorderCategoriesDto) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.category.updateMany({
          where: { id: item.id, restaurantId },
          data: { sortOrder: item.sortOrder },
        });
      }
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return { message: 'Categories reordered' };
    });
  }
}
