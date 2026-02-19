import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { PlanLimitsService } from '../common/plan-limits.service';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  ToggleAvailabilityDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateAddonDto,
  UpdateAddonDto,
  CreatePriceOverrideDto,
  CreateComboItemDto,
  UpdateComboItemDto,
  ImportMenuCsvDto,
} from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
    private planLimits: PlanLimitsService,
  ) {}

  // ─── Menu Items ───────────────────────────────────────────────

  async getAll(restaurantId: string, categoryId?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        isArchived: false,
        ...(categoryId && { categoryId }),
      },
      include: {
        category: { select: { id: true, name: true } },
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        addons: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        taxGroup: { include: { components: true } },
        priceOverrides: { where: { isActive: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getOne(restaurantId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, restaurantId, isArchived: false },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
        addons: { orderBy: { sortOrder: 'asc' } },
        taxGroup: { include: { components: true } },
        priceOverrides: true,
      },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async create(restaurantId: string, dto: CreateMenuItemDto) {
    await this.planLimits.enforce(restaurantId, 'menuItems');
    // Verify category belongs to restaurant
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, restaurantId },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Check barcode uniqueness
    if (dto.barcode) {
      const barcodeExists = await this.prisma.menuItem.findUnique({
        where: {
          barcode_restaurantId: { barcode: dto.barcode, restaurantId },
        },
      });
      if (barcodeExists) throw new ConflictException('Barcode already in use');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: { restaurantId, ...dto },
        include: { category: true, taxGroup: { include: { components: true } } },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return item;
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateMenuItemDto) {
    await this.getOne(restaurantId, id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, restaurantId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.update({
        where: { id },
        data: dto,
        include: { category: true, taxGroup: { include: { components: true } } },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return item;
    });
  }

  async toggleAvailability(
    restaurantId: string,
    id: string,
    dto: ToggleAvailabilityDto,
    branchId?: string,
  ) {
    await this.getOne(restaurantId, id);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.update({
        where: { id },
        data: { isAvailable: dto.isAvailable },
        select: { id: true, name: true, isAvailable: true },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });

      // Emit real-time event to all branch clients
      if (branchId) {
        this.gateway.emitToBranch(branchId, 'menu:item_availability', {
          itemId: id,
          isAvailable: dto.isAvailable,
        });
      }

      return item;
    });
  }

  async archive(restaurantId: string, id: string) {
    await this.getOne(restaurantId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id },
        data: { isArchived: true, isAvailable: false },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return { message: 'Menu item archived' };
    });
  }

  // ─── Variants ─────────────────────────────────────────────────

  async createVariant(restaurantId: string, itemId: string, dto: CreateVariantDto) {
    await this.getOne(restaurantId, itemId);

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.itemVariant.create({
        data: { menuItemId: itemId, ...dto },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return variant;
    });
  }

  async updateVariant(
    restaurantId: string,
    itemId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    await this.getOne(restaurantId, itemId);

    const variant = await this.prisma.itemVariant.findFirst({
      where: { id: variantId, menuItemId: itemId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.itemVariant.update({ where: { id: variantId }, data: dto });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return updated;
    });
  }

  async deleteVariant(restaurantId: string, itemId: string, variantId: string) {
    await this.getOne(restaurantId, itemId);
    const variant = await this.prisma.itemVariant.findFirst({
      where: { id: variantId, menuItemId: itemId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.itemVariant.delete({ where: { id: variantId } });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
    });
    return { message: 'Variant deleted' };
  }

  // ─── Addons ───────────────────────────────────────────────────

  async createAddon(restaurantId: string, itemId: string, dto: CreateAddonDto) {
    await this.getOne(restaurantId, itemId);

    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.itemAddon.create({
        data: { menuItemId: itemId, ...dto },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return addon;
    });
  }

  async updateAddon(
    restaurantId: string,
    itemId: string,
    addonId: string,
    dto: UpdateAddonDto,
  ) {
    await this.getOne(restaurantId, itemId);

    const addon = await this.prisma.itemAddon.findFirst({
      where: { id: addonId, menuItemId: itemId },
    });
    if (!addon) throw new NotFoundException('Addon not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.itemAddon.update({ where: { id: addonId }, data: dto });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return updated;
    });
  }

  async deleteAddon(restaurantId: string, itemId: string, addonId: string) {
    await this.getOne(restaurantId, itemId);
    const addon = await this.prisma.itemAddon.findFirst({
      where: { id: addonId, menuItemId: itemId },
    });
    if (!addon) throw new NotFoundException('Addon not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.itemAddon.delete({ where: { id: addonId } });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
    });
    return { message: 'Addon deleted' };
  }

  // ─── Price Overrides ──────────────────────────────────────────

  async upsertPriceOverride(
    restaurantId: string,
    itemId: string,
    dto: CreatePriceOverrideDto,
  ) {
    await this.getOne(restaurantId, itemId);

    return this.prisma.$transaction(async (tx) => {
      const override = await tx.itemPriceOverride.upsert({
        where: {
          menuItemId_variantId_orderType: {
            menuItemId: itemId,
            variantId: dto.variantId ?? '',
            orderType: dto.orderType,
          },
        },
        update: { price: dto.price, isActive: true },
        create: {
          menuItemId: itemId,
          variantId: dto.variantId,
          orderType: dto.orderType,
          price: dto.price,
        },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return override;
    });
  }

  async deletePriceOverride(restaurantId: string, itemId: string, overrideId: string) {
    await this.getOne(restaurantId, itemId);
    await this.prisma.itemPriceOverride.delete({ where: { id: overrideId } });
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { menuVersion: { increment: 1 } },
    });
    return { message: 'Price override removed' };
  }

  // ─── Combo Items ──────────────────────────────────────────────

  async getCombos(restaurantId: string) {
    return this.prisma.comboItem.findMany({
      where: { restaurantId },
      include: { entries: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCombo(restaurantId: string, dto: CreateComboItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const combo = await tx.comboItem.create({
        data: {
          restaurantId,
          name: dto.name,
          price: dto.price,
          description: dto.description,
          imageUrl: dto.imageUrl,
          entries: {
            create: dto.entries.map((e) => ({
              menuItemId: e.menuItemId,
              quantity: e.quantity ?? 1,
            })),
          },
        },
        include: { entries: true },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return combo;
    });
  }

  async updateCombo(restaurantId: string, id: string, dto: UpdateComboItemDto) {
    const combo = await this.prisma.comboItem.findFirst({
      where: { id, restaurantId },
    });
    if (!combo) throw new NotFoundException('Combo item not found');

    const { entries, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (entries !== undefined) {
        await tx.comboItemEntry.deleteMany({ where: { comboItemId: id } });
      }

      const updated = await tx.comboItem.update({
        where: { id },
        data: {
          ...rest,
          ...(entries && {
            entries: {
              create: entries.map((e) => ({
                menuItemId: e.menuItemId,
                quantity: e.quantity ?? 1,
              })),
            },
          }),
        },
        include: { entries: true },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
      return updated;
    });
  }

  async deleteCombo(restaurantId: string, id: string) {
    const combo = await this.prisma.comboItem.findFirst({
      where: { id, restaurantId },
    });
    if (!combo) throw new NotFoundException('Combo item not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.comboItemEntry.deleteMany({ where: { comboItemId: id } });
      await tx.comboItem.delete({ where: { id } });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
    });
    return { message: 'Combo deleted' };
  }

  // ─── CSV Import ───────────────────────────────────────────────

  async importCsv(restaurantId: string, dto: ImportMenuCsvDto) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        try {
          // Find or create category
          let category = await tx.category.findFirst({
            where: { restaurantId, name: row.category },
          });
          if (!category) {
            category = await tx.category.create({
              data: { restaurantId, name: row.category },
            });
          }

          await tx.menuItem.create({
            data: {
              restaurantId,
              categoryId: category.id,
              name: row.name,
              shortName: row.shortName,
              description: row.description,
              price: row.price,
              foodType: row.foodType,
              kitchenStation: row.kitchenStation,
              barcode: row.barcode,
            },
          });
          results.created++;
        } catch {
          results.skipped++;
          results.errors.push(`Row "${row.name}": import failed`);
        }
      }

      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { menuVersion: { increment: 1 } },
      });
    });

    return results;
  }
}
