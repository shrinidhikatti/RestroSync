import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SplitBillDto, TransferTableDto, MergeTablesDto } from './dto/integrations.dto';

@Injectable()
export class AdvancedPosService {
  constructor(private prisma: PrismaService) {}

  // ── Split Bill ────────────────────────────────────────────────────────────
  // Returns split groups with calculated totals (does NOT create child bills —
  // the cashier finalises each split separately via the normal billing flow).

  async splitBill(restaurantId: string, dto: SplitBillDto) {
    const order = await this.prisma.order.findFirst({
      where:   { id: dto.orderId, branch: { restaurantId } },
      include: { items: { where: { status: { not: 'VOIDED' } } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const activeItems = order.items;
    if (activeItems.length === 0) throw new BadRequestException('No active items to split');

    if (dto.splitType === 'EQUAL') {
      const count = dto.splitCount ?? 2;
      if (count < 2) throw new BadRequestException('splitCount must be >= 2');

      const perPersonTotal = Number(order.grandTotal) / count;
      return {
        orderId:    order.id,
        splitType:  'EQUAL',
        splitCount: count,
        perPersonTotal: +perPersonTotal.toFixed(2),
        grandTotal: Number(order.grandTotal),
      };
    }

    if (dto.splitType === 'BY_ITEM') {
      if (!dto.itemGroups || dto.itemGroups.length < 2) {
        throw new BadRequestException('Provide at least 2 itemGroups for BY_ITEM split');
      }

      const itemMap = new Map(activeItems.map((i) => [i.id, i]));
      const groups = dto.itemGroups.map((g, idx) => {
        const groupItems = g.itemIds.map((iid) => {
          const item = itemMap.get(iid);
          if (!item) throw new BadRequestException(`Item ${iid} not found in order`);
          return item;
        });
        const subtotal = groupItems.reduce(
          (s, i) => s + Number(i.unitPrice) * i.quantity,
          0,
        );
        return { group: idx + 1, itemIds: g.itemIds, subtotal: +subtotal.toFixed(2) };
      });

      return { orderId: order.id, splitType: 'BY_ITEM', groups };
    }

    throw new BadRequestException('splitType must be EQUAL or BY_ITEM');
  }

  // ── Transfer Table ────────────────────────────────────────────────────────

  async transferTable(restaurantId: string, dto: TransferTableDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, branch: { restaurantId } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const toTable = await this.prisma.table.findFirst({
      where: { id: dto.toTableId, branch: { restaurantId } },
    });
    if (!toTable) throw new NotFoundException('Target table not found');
    if (toTable.status !== 'AVAILABLE') {
      throw new BadRequestException(`Table "${toTable.number}" is not available`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Free the current table
      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data:  { status: 'AVAILABLE' },
        });
      }

      // Occupy the new table
      await tx.table.update({
        where: { id: dto.toTableId },
        data:  { status: 'OCCUPIED' },
      });

      // Move the order
      return tx.order.update({
        where: { id: order.id },
        data:  { tableId: dto.toTableId },
      });
    });
  }

  // ── Merge Tables (Orders) ─────────────────────────────────────────────────
  // Merges all items from subsequent orders into the first order,
  // frees their tables, and cancels the source orders.

  async mergeOrders(restaurantId: string, dto: MergeTablesDto) {
    if (dto.orderIds.length < 2) {
      throw new BadRequestException('Provide at least 2 orderIds to merge');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        id:     { in: dto.orderIds },
        branch: { restaurantId },
      },
      include: { items: { where: { status: { not: 'VOIDED' } } } },
    });

    if (orders.length !== dto.orderIds.length) {
      throw new NotFoundException('One or more orders not found');
    }

    const [primary, ...sources] = orders;

    return this.prisma.$transaction(async (tx) => {
      // Move all items from source orders to primary order
      for (const src of sources) {
        await tx.orderItem.updateMany({
          where: { orderId: src.id },
          data:  { orderId: primary.id },
        });

        // Free source table
        if (src.tableId) {
          await tx.table.update({
            where: { id: src.tableId },
            data:  { status: 'AVAILABLE' },
          });
        }

        // Cancel source order
        await tx.order.update({
          where: { id: src.id },
          data:  { status: 'CANCELLED', cancelReason: `Merged into order ${primary.id}` },
        });
      }

      // Recalculate totals on primary order
      const allItems = await tx.orderItem.findMany({
        where: { orderId: primary.id, status: { not: 'VOIDED' } },
      });

      const subtotal = allItems.reduce(
        (s, i) => s + Number(i.unitPrice) * i.quantity,
        0,
      );

      return tx.order.update({
        where: { id: primary.id },
        data:  { subtotal, grandTotal: subtotal },  // simplified — tax recalc on bill generation
        include: { items: true },
      });
    });
  }
}
