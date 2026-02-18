import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockInDto, ManualStockOutDto } from './dto/inventory.dto';
import { StockTransactionType } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // ── Current stock levels ─────────────────────────────────────────────────────

  async getStockLevels(branchId: string) {
    return this.prisma.stock.findMany({
      where: { branchId },
      include: {
        ingredient: true,
      },
      orderBy: { ingredient: { name: 'asc' } },
    });
  }

  async getStockForIngredient(branchId: string, ingredientId: string) {
    return this.prisma.stock.findUnique({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      include: {
        ingredient: true,
      },
    });
  }

  // ── Stock-in (purchase) ──────────────────────────────────────────────────────

  async stockIn(branchId: string, createdBy: string, dto: StockInDto) {
    // Validate ingredient exists
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: dto.ingredientId },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    return this.prisma.$transaction(async (tx) => {
      // 1. Create stock batch
      await tx.stockBatch.create({
        data: {
          branchId:          branchId,
          ingredientId:      dto.ingredientId,
          batchNumber:       dto.batchNumber,
          purchaseDate:      new Date(dto.purchaseDate),
          expiryDate:        dto.expiryDate ? new Date(dto.expiryDate) : null,
          quantityIn:        dto.quantity,
          quantityUsed:      0,
          quantityRemaining: dto.quantity,
          supplierId:        dto.supplierId,
          costPerUnit:       dto.costPerUnit,
        },
      });

      // 2. Update current stock level (upsert)
      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId: dto.ingredientId } },
        create: {
          branchId,
          ingredientId:    dto.ingredientId,
          currentQuantity: dto.quantity,
        },
        update: {
          currentQuantity: { increment: dto.quantity },
        },
      });

      // 3. Log stock transaction
      await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId:   dto.ingredientId,
          type:           StockTransactionType.PURCHASE,
          quantity:       dto.quantity,
          purchaseOrderId: dto.purchaseOrderId,
          createdBy,
        },
      });

      return this.getStockForIngredient(branchId, dto.ingredientId);
    });
  }

  // ── Manual stock-out (wastage / adjustment) ──────────────────────────────────

  async manualStockOut(branchId: string, createdBy: string, dto: ManualStockOutDto) {
    const stock = await this.getStockForIngredient(branchId, dto.ingredientId);
    if (!stock) throw new NotFoundException('No stock record found for this ingredient');

    if (Number(stock.currentQuantity) < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${stock.currentQuantity} ${stock.ingredient.unit}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // FIFO: deduct from oldest batches first
      await this._deductFifo(tx, branchId, dto.ingredientId, dto.quantity);

      // Update current quantity
      await tx.stock.update({
        where: { branchId_ingredientId: { branchId, ingredientId: dto.ingredientId } },
        data:  { currentQuantity: { decrement: dto.quantity } },
      });

      // Log transaction
      await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId: dto.ingredientId,
          type:         dto.type === 'WASTAGE'
            ? StockTransactionType.WASTAGE
            : StockTransactionType.ADJUSTMENT,
          quantity:     dto.quantity,
          reason:       dto.reason,
          createdBy,
        },
      });

      return this.getStockForIngredient(branchId, dto.ingredientId);
    });
  }

  // ── Auto stock-out for an order (called after KOT generation) ────────────────

  async deductForOrder(
    branchId:  string,
    orderId:   string,
    createdBy: string,
  ) {
    // Get order items with menuItemIds
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { status: { not: 'VOIDED' } },
          select: { menuItemId: true, quantity: true },
        },
      },
    });
    if (!order) return;

    for (const item of order.items) {
      if (!item.menuItemId) continue;

      const recipe = await this.prisma.recipe.findFirst({
        where: { menuItemId: item.menuItemId },
        include: { ingredients: true },
      });
      if (!recipe) continue;

      for (const ri of recipe.ingredients) {
        if (!ri.ingredientId) continue; // sub-recipe, skip for now
        const needed = Number(ri.quantity) * item.quantity;

        const stock = await this.getStockForIngredient(branchId, ri.ingredientId);
        if (!stock || Number(stock.currentQuantity) < needed) {
          // Insufficient stock — log but don't block the order
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          await this._deductFifo(tx, branchId, ri.ingredientId!, needed);
          await tx.stock.update({
            where: { branchId_ingredientId: { branchId, ingredientId: ri.ingredientId! } },
            data:  { currentQuantity: { decrement: needed } },
          });
          await tx.stockTransaction.create({
            data: {
              branchId,
              ingredientId: ri.ingredientId!,
              type:         StockTransactionType.CONSUMPTION,
              quantity:     needed,
              reason:       `Order ${orderId}`,
              createdBy,
            },
          });
        });
      }
    }
  }

  // ── FIFO batch deduction (private helper) ─────────────────────────────────────

  private async _deductFifo(
    tx:           any,
    branchId:     string,
    ingredientId: string,
    quantity:     number,
  ) {
    // Fetch batches ordered oldest first (FIFO)
    const batches = await tx.stockBatch.findMany({
      where: {
        branchId,
        ingredientId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: { purchaseDate: 'asc' },
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(Number(batch.quantityRemaining), remaining);

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: {
          quantityUsed:      { increment: deduct },
          quantityRemaining: { decrement: deduct },
        },
      });
      remaining -= deduct;
    }
  }

  // ── Stock transactions log ────────────────────────────────────────────────────

  async getTransactions(
    branchId:     string,
    ingredientId?: string,
    limit          = 100,
  ) {
    return this.prisma.stockTransaction.findMany({
      where: {
        branchId,
        ...(ingredientId && { ingredientId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Active batches for an ingredient ─────────────────────────────────────────

  async getBatches(branchId: string, ingredientId: string) {
    return this.prisma.stockBatch.findMany({
      where: {
        branchId,
        ingredientId,
      },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  // ── Write off expired batch ───────────────────────────────────────────────────

  async writeOffBatch(batchId: string, branchId: string, createdBy: string) {
    const batch = await this.prisma.stockBatch.findFirst({
      where: { id: batchId, branchId },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const qty = Number(batch.quantityRemaining);
    if (qty <= 0) throw new BadRequestException('Batch already fully consumed');

    return this.prisma.$transaction(async (tx) => {
      await tx.stockBatch.update({
        where: { id: batchId },
        data: {
          quantityUsed:      { increment: qty },
          quantityRemaining: 0,
        },
      });

      await tx.stock.update({
        where: { branchId_ingredientId: { branchId, ingredientId: batch.ingredientId } },
        data:  { currentQuantity: { decrement: qty } },
      });

      await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId: batch.ingredientId,
          type:         StockTransactionType.WASTAGE,
          quantity:     qty,
          reason:       `Expired batch write-off: ${batch.batchNumber ?? batchId}`,
          createdBy,
        },
      });

      return { written_off: qty };
    });
  }
}
