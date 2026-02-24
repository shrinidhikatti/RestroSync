import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto, UpdateOrderDto, CancelOrderDto,
  AddOrderItemDto, UpdateOrderItemDto, VoidOrderItemDto,
} from './dto/order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Business date ───────────────────────────────────────────────────────────

  private getBusinessDate(): Date {
    const now = new Date();
    const cutoffHour = 5; // 05:00
    const businessDate = new Date(now);
    if (now.getHours() < cutoffHour) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    businessDate.setHours(0, 0, 0, 0);
    return businessDate;
  }

  // ─── Token number ────────────────────────────────────────────────────────────

  private async nextTokenNumber(branchId: string): Promise<number> {
    const businessDate = this.getBusinessDate();
    const start = new Date(businessDate);
    const end = new Date(businessDate);
    end.setDate(end.getDate() + 1);

    const last = await this.prisma.order.findFirst({
      where: {
        branchId,
        businessDate: { gte: start, lt: end },
        tokenNumber: { not: null },
      },
      orderBy: { tokenNumber: 'desc' },
      select: { tokenNumber: true },
    });
    return (last?.tokenNumber ?? 0) + 1;
  }

  // ─── Create order ────────────────────────────────────────────────────────────

  async createOrder(branchId: string, userId: string, userName: string, restaurantId: string, dto: CreateOrderDto) {
    // Validate table for DINE_IN
    if (dto.type === 'DINE_IN' && dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, branchId, isActive: true },
      });
      if (!table) throw new BadRequestException('Table not found');
      if (table.status === 'OCCUPIED') throw new BadRequestException('Table is already occupied');
    }

    // Token number for COUNTER mode
    let tokenNumber: number | undefined;
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { operatingMode: true },
    });
    if (restaurant?.operatingMode === 'COUNTER') {
      tokenNumber = await this.nextTokenNumber(branchId);
    }

    const businessDate = this.getBusinessDate();

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          branchId,
          tableId: dto.tableId ?? null,
          orderType: dto.type as any,
          status: 'NEW',
          priority: (dto.priority ?? 'NORMAL') as any,
          tokenNumber: tokenNumber ?? null,
          customerName: dto.customerName ?? null,
          customerPhone: dto.customerPhone ?? null,
          customerAddress: dto.customerAddress ?? null,
          complimentaryReason: dto.complimentaryReason ?? null,
          complimentaryNote: dto.complimentaryNote ?? null,
          notes: dto.notes ?? null,
          captainId: userId,
          captainName: userName,
          createdBy: userId,
          businessDate,
        },
        include: { items: true, table: { select: { number: true, section: true } } },
      });

      // Update table status to OCCUPIED
      if (dto.type === 'DINE_IN' && dto.tableId) {
        await tx.table.update({
          where: { id: dto.tableId },
          data: { status: 'OCCUPIED', occupiedSince: new Date() },
        });
      }

      return newOrder;
    });

    return order;
  }

  // ─── List orders ─────────────────────────────────────────────────────────────

  async getOrders(
    branchId: string,
    query: { status?: string; type?: string; tableId?: string; date?: string; limit?: number; offset?: number },
  ) {
    const where: any = { branchId };
    if (query.status) where.status = query.status;
    if (query.type) where.orderType = query.type;
    if (query.tableId) where.tableId = query.tableId;
    if (query.date) {
      const d = new Date(query.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.businessDate = { gte: d, lt: next };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          table: { select: { number: true, section: true } },
          items: { where: { status: { not: 'VOIDED' } }, select: { id: true, itemName: true, quantity: true, status: true } },
          bills: { select: { id: true, status: true, grandTotal: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  // ─── Get order detail ─────────────────────────────────────────────────────────

  async getOrderById(orderId: string, branchId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        table: { select: { id: true, number: true, section: true, capacity: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: { kot: { select: { kotNumber: true, type: true } } },
        },
        kots: { orderBy: { createdAt: 'asc' }, include: { items: { select: { id: true, itemName: true, quantity: true } } } },
        bills: {
          include: { payments: true, refunds: { include: { items: true } } },
        },
        orderDiscounts: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ─── Update order ─────────────────────────────────────────────────────────────

  async updateOrder(orderId: string, branchId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException('Order not found');
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Cannot update a completed or cancelled order');
    }

    // Table change
    if (dto.tableId && dto.tableId !== order.tableId) {
      const newTable = await this.prisma.table.findFirst({ where: { id: dto.tableId, branchId, isActive: true } });
      if (!newTable) throw new BadRequestException('Target table not found');
      if (newTable.status === 'OCCUPIED') throw new BadRequestException('Target table is already occupied');

      await this.prisma.$transaction(async (tx) => {
        // Free old table if this is the only active order on it
        if (order.tableId) {
          const otherOrders = await tx.order.count({
            where: { tableId: order.tableId, status: { notIn: ['COMPLETED', 'CANCELLED', 'BILLED'] }, id: { not: orderId } },
          });
          if (otherOrders === 0) {
            await tx.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE', occupiedSince: null } });
          }
        }
        // Occupy new table
        await tx.table.update({ where: { id: dto.tableId! }, data: { status: 'OCCUPIED', occupiedSince: new Date() } });
        await tx.order.update({ where: { id: orderId }, data: { tableId: dto.tableId } });
      });
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerAddress: dto.customerAddress,
        notes: dto.notes,
        priority: dto.priority as any,
      },
    });
  }

  // ─── Cancel order ─────────────────────────────────────────────────────────────

  async cancelOrder(orderId: string, branchId: string, userId: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException('Order not found');
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Order is already completed or cancelled');
    }
    // Cannot cancel if billed and paid
    const paidBill = await this.prisma.bill.findFirst({ where: { orderId, status: 'PAID' } });
    if (paidBill) throw new BadRequestException('Cannot cancel a paid order');

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledBy: userId, cancelReason: dto.reason },
      });

      // Void any unpaid bills
      await tx.bill.updateMany({
        where: { orderId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        data: { status: 'VOID', isVoid: true, voidReason: 'Order cancelled', voidedBy: userId, voidedAt: new Date() },
      });

      // Free table
      if (order.tableId) {
        const otherOrders = await tx.order.count({
          where: { tableId: order.tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, id: { not: orderId } },
        });
        if (otherOrders === 0) {
          await tx.table.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE', occupiedSince: null } });
          // Release any tables merged into this table
          await tx.table.updateMany({
            where: { mergedIntoTableId: order.tableId },
            data: { status: 'AVAILABLE', occupiedSince: null, mergedIntoTableId: null },
          });
        }
      }
    });

    return { message: 'Order cancelled successfully' };
  }

  // ─── Add items ────────────────────────────────────────────────────────────────

  async addItems(orderId: string, branchId: string, restaurantId: string, dtos: AddOrderItemDto[]) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException('Order not found');
    if (['COMPLETED', 'CANCELLED', 'BILLED'].includes(order.status)) {
      throw new BadRequestException('Cannot add items to this order');
    }

    // Determine round number (number of KOTs already + 1)
    const kotCount = await this.prisma.kot.count({ where: { orderId } });
    const roundNumber = kotCount + 1;

    const createdItems = await this.prisma.$transaction(async (tx) => {
      const items = [];
      for (const dto of dtos) {
        const menuItem = await tx.menuItem.findFirst({
          where: { id: dto.menuItemId, restaurantId, isArchived: false },
          include: { variants: true, taxGroup: { include: { components: true } } },
        });
        if (!menuItem) throw new NotFoundException(`Menu item ${dto.menuItemId} not found`);
        if (!menuItem.isAvailable) throw new BadRequestException(`${menuItem.name} is not available`);

        // Resolve price
        let unitPrice = Number(menuItem.price);
        let variantName: string | null = null;

        if (dto.variantId) {
          const variant = menuItem.variants.find((v) => v.id === dto.variantId);
          if (!variant) throw new BadRequestException('Variant not found');
          unitPrice = Number(variant.price);
          variantName = variant.name;
        }

        // Check price override for order type
        const override = await tx.itemPriceOverride.findFirst({
          where: {
            menuItemId: dto.menuItemId,
            variantId: dto.variantId ?? null,
            orderType: order.orderType as any,
            isActive: true,
          },
        });
        if (override) unitPrice = Number(override.price);

        // Compute tax percent
        let taxPercent = 0;
        let taxGroupName: string | null = null;
        if (menuItem.taxGroup) {
          taxPercent = menuItem.taxGroup.components.reduce((s, c) => s + Number(c.rate), 0);
          taxGroupName = menuItem.taxGroup.name;
        }

        // Addon prices
        const addonData = dto.addons?.map((a) => ({ name: a.name, price: a.price })) ?? [];

        const item = await tx.orderItem.create({
          data: {
            orderId,
            menuItemId: dto.menuItemId,
            roundNumber,
            itemName: menuItem.name,
            itemShortName: menuItem.shortName ?? null,
            variantName,
            unitPrice,
            quantity: dto.quantity,
            taxPercent,
            taxGroupName,
            addons: addonData.length > 0 ? addonData : undefined,
            specialInstructions: dto.specialInstructions ?? null,
            priority: (dto.priority ?? order.priority) as any,
            status: 'PENDING',
          },
        });
        items.push(item);
      }

      // Recalculate order totals
      await this.recalculateOrderTotals(tx, orderId);

      return items;
    });

    return createdItems;
  }

  // ─── Update order item ────────────────────────────────────────────────────────

  async updateOrderItem(orderId: string, itemId: string, branchId: string, dto: UpdateOrderItemDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.branchId !== branchId) throw new NotFoundException('Order not found');
    if (item.kotId) throw new BadRequestException('Cannot modify item after KOT is sent');
    if (item.status === 'VOIDED') throw new BadRequestException('Item is already voided');

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: dto.quantity,
          specialInstructions: dto.specialInstructions,
          priority: dto.priority as any,
        },
      });
      await this.recalculateOrderTotals(tx, orderId);
    });

    return this.prisma.orderItem.findUnique({ where: { id: itemId } });
  }

  // ─── Void order item ──────────────────────────────────────────────────────────

  async voidOrderItem(orderId: string, itemId: string, branchId: string, userId: string, dto: VoidOrderItemDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.branchId !== branchId) throw new NotFoundException('Order not found');
    if (item.status === 'VOIDED') throw new BadRequestException('Item is already voided');

    await this.prisma.$transaction(async (tx) => {
      if (!item.kotId) {
        // Pre-KOT: hard delete
        await tx.orderItem.delete({ where: { id: itemId } });
      } else {
        // Post-KOT: soft void
        await tx.orderItem.update({
          where: { id: itemId },
          data: { status: 'VOIDED', voidedAt: new Date(), voidedBy: userId, voidReason: dto.reason },
        });
      }
      await this.recalculateOrderTotals(tx, orderId);
    });

    return { message: 'Item voided successfully' };
  }

  // ─── Recalculate order totals ─────────────────────────────────────────────────

  async recalculateOrderTotals(tx: any, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId, status: { not: 'VOIDED' } },
    });

    let subtotal = 0;
    for (const item of items) {
      const addonTotal = Array.isArray(item.addons)
        ? (item.addons as any[]).reduce((s: number, a: any) => s + Number(a.price), 0)
        : 0;
      subtotal += (Number(item.unitPrice) + addonTotal) * item.quantity;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, grandTotal: subtotal }, // Tax/discount applied at bill generation
    });
  }

  // ─── Get active orders for a captain (for shift handover) ────────────────────

  async getCaptainActiveOrders(captainId: string, branchId: string) {
    return this.prisma.order.findMany({
      where: {
        captainId,
        branchId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        table: { select: { number: true, section: true } },
        items: { where: { status: { not: 'VOIDED' } }, select: { id: true, itemName: true, quantity: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Reassign orders to another captain ──────────────────────────────────────

  async reassignOrders(
    fromCaptainId: string,
    toCaptainId: string,
    branchId: string,
    orderIds?: string[], // if empty → reassign all active orders
  ) {
    // Look up the new captain's name
    const newCaptain = await this.prisma.user.findFirst({
      where: { id: toCaptainId, branchId, isActive: true },
      select: { id: true, name: true, role: true },
    });
    if (!newCaptain) throw new NotFoundException('Target captain not found or not active');

    const where: any = {
      branchId,
      captainId: fromCaptainId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    };
    if (orderIds && orderIds.length > 0) {
      where.id = { in: orderIds };
    }

    const result = await this.prisma.order.updateMany({
      where,
      data: { captainId: toCaptainId, captainName: newCaptain.name },
    });

    return {
      message: `${result.count} order${result.count !== 1 ? 's' : ''} transferred to ${newCaptain.name}`,
      count: result.count,
      newCaptain: { id: newCaptain.id, name: newCaptain.name },
    };
  }

  // ─── List all captains with active orders (for reassignment picker) ───────────

  async getActiveCaptains(branchId: string) {
    const orders = await this.prisma.order.findMany({
      where: { branchId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, captainId: { not: null } },
      select: { captainId: true, captainName: true },
      distinct: ['captainId'],
    });
    return orders.map((o) => ({ id: o.captainId, name: o.captainName }));
  }
}
