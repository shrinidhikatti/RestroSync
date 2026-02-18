import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { GenerateKotDto } from './dto/order.dto';

@Injectable()
export class KotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
  ) {}

  // ─── Generate KOT number ─────────────────────────────────────────────────────

  private async nextKotNumber(branchId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.prisma.kot.count({
      where: { branchId, createdAt: { gte: startOfDay, lte: endOfDay } },
    });
    return `KOT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  // ─── Generate KOT ────────────────────────────────────────────────────────────

  async generateKot(orderId: string, branchId: string, dto: GenerateKotDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        items: {
          where: { status: 'PENDING', kotId: null },
          include: { order: { select: { orderType: true, tableId: true } } },
        },
        table: { select: { number: true, section: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Filter to specific items if provided
    let pendingItems = order.items;
    if (dto.orderItemIds && dto.orderItemIds.length > 0) {
      pendingItems = pendingItems.filter((i) => dto.orderItemIds!.includes(i.id));
    }

    if (pendingItems.length === 0) {
      throw new BadRequestException('No pending items to send to kitchen');
    }

    // Get current round number
    const kotCount = await this.prisma.kot.count({ where: { orderId } });
    const roundNumber = kotCount + 1;

    // Group items by kitchenStation
    const stationGroups = new Map<string, typeof pendingItems>();
    for (const item of pendingItems) {
      // Get kitchen station from menu item
      const menuItem = item.menuItemId
        ? await this.prisma.menuItem.findUnique({ where: { id: item.menuItemId }, select: { kitchenStation: true } })
        : null;
      const station = menuItem?.kitchenStation ?? 'KITCHEN';

      if (!stationGroups.has(station)) stationGroups.set(station, []);
      stationGroups.get(station)!.push(item);
    }

    const kots = [];

    for (const [station, items] of stationGroups) {
      const kotNumber = await this.nextKotNumber(branchId);

      const kot = await this.prisma.$transaction(async (tx) => {
        const newKot = await tx.kot.create({
          data: {
            branchId,
            orderId,
            kotNumber,
            type: 'REGULAR',
            roundNumber,
            kitchenStation: station,
            printedAt: new Date(),
          },
        });

        // Link items to KOT
        await tx.orderItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { kotId: newKot.id, status: 'PREPARING' },
        });

        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PREPARING' },
        });

        return newKot;
      });

      // Emit real-time events
      const kotPayload = {
        kotId: kot.id,
        kotNumber: kot.kotNumber,
        orderId,
        orderType: order.orderType,
        tableNumber: order.table?.number ?? null,
        tableSection: order.table?.section ?? null,
        items: items.map((i) => ({
          name: i.itemName,
          variantName: i.variantName,
          quantity: i.quantity,
          addons: i.addons,
          specialInstructions: i.specialInstructions,
          priority: i.priority,
        })),
        roundNumber,
        createdAt: kot.createdAt,
      };

      this.gateway.emitToKitchen(branchId, station, 'kot:new', kotPayload);
      this.gateway.emitToBranch(branchId, 'order:updated', { orderId, status: 'PREPARING' });

      kots.push({ ...kot, items });
    }

    return kots;
  }

  // ─── List KOTs for order ──────────────────────────────────────────────────────

  async getOrderKots(orderId: string, branchId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.kot.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { select: { id: true, itemName: true, variantName: true, quantity: true, status: true, addons: true, specialInstructions: true } },
      },
    });
  }

  // ─── Reprint KOT ─────────────────────────────────────────────────────────────

  async reprintKot(kotId: string, branchId: string) {
    const kot = await this.prisma.kot.findFirst({
      where: { id: kotId, branchId },
      include: { items: true, order: { include: { table: { select: { number: true } } } } },
    });
    if (!kot) throw new NotFoundException('KOT not found');

    // Create a REPRINT KOT record
    const reprintKot = await this.prisma.kot.create({
      data: {
        branchId,
        orderId: kot.orderId,
        kotNumber: `${kot.kotNumber}-R`,
        type: 'REPRINT',
        roundNumber: kot.roundNumber,
        kitchenStation: kot.kitchenStation,
        printedAt: new Date(),
      },
    });

    this.gateway.emitToBranch(branchId, 'kot:reprinted', {
      originalKotId: kotId,
      reprintKotId: reprintKot.id,
    });

    return reprintKot;
  }

  // ─── Update item status (for KDS) ────────────────────────────────────────────

  async updateItemStatus(itemId: string, branchId: string, status: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId },
      include: { order: { select: { branchId: true, id: true } } },
    });
    if (!item || item.order.branchId !== branchId) throw new NotFoundException('Item not found');

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status: status as any },
    });

    // If all non-voided items in the order are READY, update order to READY
    const pendingItems = await this.prisma.orderItem.count({
      where: {
        orderId: item.order.id,
        status: { notIn: ['READY', 'SERVED', 'VOIDED'] },
      },
    });

    if (pendingItems === 0 && status === 'READY') {
      await this.prisma.order.update({ where: { id: item.order.id }, data: { status: 'READY' } });
      this.gateway.emitToBranch(branchId, 'order:ready', { orderId: item.order.id });
    }

    return { message: 'Status updated' };
  }
}
