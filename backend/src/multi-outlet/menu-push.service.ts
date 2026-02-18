import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushMenuToBranchDto, UpsertBranchOverrideDto } from './dto/multi-outlet.dto';

@Injectable()
export class MenuPushService {
  constructor(private prisma: PrismaService) {}

  // ── Push central menu to branches ─────────────────────────────────────────
  // "Pushing" the central menu means marking all target branches as receiving
  // the restaurant-level menu. Since MenuItem is already restaurant-scoped,
  // all branches see the full menu by default.
  // Push creates/resets BranchMenuOverride so all items are available.

  async pushToAllBranches(restaurantId: string, dto: PushMenuToBranchDto) {
    const branches = await this.prisma.branch.findMany({
      where: {
        restaurantId,
        id: dto.branchIds.length ? { in: dto.branchIds } : undefined,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    // Get all active menu items for restaurant (filtered by category if specified)
    const items = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        isArchived: false,
        categoryId: dto.categoryIds?.length ? { in: dto.categoryIds } : undefined,
      },
      select: { id: true, name: true },
    });

    // Upsert BranchMenuOverride for each branch × item (mark available = true, clear price override)
    let pushed = 0;
    for (const branch of branches) {
      for (const item of items) {
        await this.prisma.branchMenuOverride.upsert({
          where:  { branchId_menuItemId: { branchId: branch.id, menuItemId: item.id } },
          create: { branchId: branch.id, menuItemId: item.id, isAvailable: true },
          update: { isAvailable: true },
        });
        pushed++;
      }
    }

    return {
      message: `Pushed ${items.length} items to ${branches.length} branches`,
      branches: branches.map((b) => b.name),
      itemCount: items.length,
      overridesUpdated: pushed,
    };
  }

  // ── Get branch overrides ──────────────────────────────────────────────────

  async getBranchOverrides(branchId: string) {
    const overrides = await this.prisma.branchMenuOverride.findMany({
      where:   { branchId },
      include: {
        menuItem: {
          select: { id: true, name: true, price: true, isAvailable: true, category: { select: { name: true } } },
        },
      },
      orderBy: { menuItem: { name: 'asc' } },
    });

    return overrides.map((o) => ({
      id:               o.id,
      menuItemId:       o.menuItemId,
      itemName:         o.menuItem.name,
      categoryName:     o.menuItem.category.name,
      basePrice:        Number(o.menuItem.price),
      centralAvailable: o.menuItem.isAvailable,
      branchAvailable:  o.isAvailable,
      priceOverride:    o.priceOverride ? Number(o.priceOverride) : null,
      effectivePrice:   o.priceOverride ? Number(o.priceOverride) : Number(o.menuItem.price),
    }));
  }

  // ── Central menu with branch override status ──────────────────────────────

  async getCentralMenuWithOverrides(restaurantId: string, branchId: string) {
    const [items, overrides] = await Promise.all([
      this.prisma.menuItem.findMany({
        where:   { restaurantId, isArchived: false },
        include: { category: { select: { name: true } } },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      }),
      this.prisma.branchMenuOverride.findMany({
        where: { branchId },
      }),
    ]);

    const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));

    return items.map((item) => {
      const override = overrideMap.get(item.id);
      return {
        id:              item.id,
        name:            item.name,
        categoryName:    item.category.name,
        basePrice:       Number(item.price),
        isAvailable:     item.isAvailable,
        hasOverride:     !!override,
        branchAvailable: override ? override.isAvailable : item.isAvailable,
        priceOverride:   override?.priceOverride ? Number(override.priceOverride) : null,
        effectivePrice:  override?.priceOverride ? Number(override.priceOverride) : Number(item.price),
      };
    });
  }

  // ── Upsert single branch override ─────────────────────────────────────────

  async upsertOverride(branchId: string, dto: UpsertBranchOverrideDto) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: dto.menuItemId } });
    if (!item) throw new NotFoundException('Menu item not found');

    return this.prisma.branchMenuOverride.upsert({
      where:  { branchId_menuItemId: { branchId, menuItemId: dto.menuItemId } },
      create: {
        branchId,
        menuItemId:    dto.menuItemId,
        isAvailable:   dto.isAvailable ?? true,
        priceOverride: dto.priceOverride,
      },
      update: {
        isAvailable:   dto.isAvailable,
        priceOverride: dto.priceOverride,
      },
    });
  }

  // ── Bulk upsert overrides ─────────────────────────────────────────────────

  async bulkUpsertOverrides(branchId: string, overrides: UpsertBranchOverrideDto[]) {
    const results = await Promise.all(
      overrides.map((dto) => this.upsertOverride(branchId, dto)),
    );
    return { updated: results.length };
  }

  // ── Delete override (revert to central) ───────────────────────────────────

  async deleteOverride(branchId: string, menuItemId: string) {
    await this.prisma.branchMenuOverride.deleteMany({
      where: { branchId, menuItemId },
    });
    return { reverted: true };
  }
}
