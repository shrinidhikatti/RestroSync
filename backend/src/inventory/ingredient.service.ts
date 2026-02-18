import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  CreateRecipeDto,
  UpdateRecipeDto,
} from './dto/inventory.dto';

@Injectable()
export class IngredientService {
  constructor(private prisma: PrismaService) {}

  // ── Ingredients ─────────────────────────────────────────────────────────────

  async listIngredients(restaurantId: string) {
    return this.prisma.ingredient.findMany({
      where: { restaurantId, isActive: true },
      include: {
        stock: {
          select: {
            branchId:        true,
            currentQuantity: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getIngredient(id: string, restaurantId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, restaurantId },
      include: {
        stock: true,
        stockBatches: {
          where: { quantityRemaining: { gt: 0 } },
          orderBy: { purchaseDate: 'asc' },
        },
      },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    return ingredient;
  }

  async createIngredient(restaurantId: string, dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: {
        restaurantId,
        name:          dto.name,
        unit:          dto.unit,
        minStockLevel: dto.minStockLevel,
        yieldPercent:  dto.yieldPercent ?? 100,
      },
    });
  }

  async updateIngredient(id: string, restaurantId: string, dto: UpdateIngredientDto) {
    await this.getIngredient(id, restaurantId);
    return this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name          !== undefined && { name:          dto.name }),
        ...(dto.unit          !== undefined && { unit:          dto.unit }),
        ...(dto.minStockLevel !== undefined && { minStockLevel: dto.minStockLevel }),
        ...(dto.yieldPercent  !== undefined && { yieldPercent:  dto.yieldPercent }),
        ...(dto.isActive      !== undefined && { isActive:      dto.isActive }),
      },
    });
  }

  async deleteIngredient(id: string, restaurantId: string) {
    await this.getIngredient(id, restaurantId);
    return this.prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Recipes ──────────────────────────────────────────────────────────────────

  async listRecipes(restaurantId: string) {
    // Recipes are linked to menu items which belong to restaurant
    return this.prisma.recipe.findMany({
      where: {
        OR: [
          { menuItem: { restaurantId } },
          { isSubRecipe: true }, // sub-recipes may not have a menuItemId
        ],
      },
      include: {
        menuItem: { select: { id: true, name: true } },
        ingredients: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getRecipe(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        menuItem: { select: { id: true, name: true } },
        ingredients: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  async createRecipe(restaurantId: string, dto: CreateRecipeDto) {
    // Validate menuItemId belongs to this restaurant
    if (dto.menuItemId) {
      const item = await this.prisma.menuItem.findFirst({
        where: { id: dto.menuItemId, restaurantId },
      });
      if (!item) throw new NotFoundException('Menu item not found');

      // One recipe per menu item
      const existing = await this.prisma.recipe.findFirst({
        where: { menuItemId: dto.menuItemId },
      });
      if (existing) throw new ConflictException('Recipe already exists for this item');
    }

    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          menuItemId:    dto.menuItemId,
          name:          dto.name,
          isSubRecipe:   dto.isSubRecipe ?? false,
          yieldQuantity: dto.yieldQuantity,
          yieldUnit:     dto.yieldUnit,
        },
      });

      if (dto.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: dto.ingredients.map((ing) => ({
            recipeId:     recipe.id,
            ingredientId: ing.ingredientId,
            subRecipeId:  ing.subRecipeId,
            quantity:     ing.quantity,
            unit:         ing.unit,
          })),
        });
      }

      return this.getRecipe(recipe.id);
    });
  }

  async updateRecipe(id: string, dto: UpdateRecipeDto) {
    await this.getRecipe(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          ...(dto.name          !== undefined && { name:          dto.name }),
          ...(dto.yieldQuantity !== undefined && { yieldQuantity: dto.yieldQuantity }),
          ...(dto.yieldUnit     !== undefined && { yieldUnit:     dto.yieldUnit }),
        },
      });

      if (dto.ingredients !== undefined) {
        // Replace all ingredients
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (dto.ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: dto.ingredients.map((ing) => ({
              recipeId:     id,
              ingredientId: ing.ingredientId,
              subRecipeId:  ing.subRecipeId,
              quantity:     ing.quantity,
              unit:         ing.unit,
            })),
          });
        }
      }

      return this.getRecipe(id);
    });
  }

  async deleteRecipe(id: string) {
    await this.getRecipe(id);
    await this.prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await this.prisma.recipe.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Low stock alert list (shared with stock service) ────────────────────────

  async getLowStockAlerts(branchId: string) {
    const stockItems = await this.prisma.stock.findMany({
      where: { branchId },
      include: { ingredient: true },
    });

    return stockItems.filter((s) => {
      const min = s.ingredient.minStockLevel;
      if (!min) return false;
      return Number(s.currentQuantity) <= Number(min);
    });
  }

  // ── Expiry alerts ────────────────────────────────────────────────────────────

  async getExpiryAlerts(branchId: string, daysAhead = 3) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.stockBatch.findMany({
      where: {
        branchId,
        quantityRemaining: { gt: 0 },
        expiryDate: { lte: cutoff },
      },
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
