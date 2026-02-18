import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptAggregatorOrderDto } from './dto/integrations.dto';

@Injectable()
export class AggregatorService {
  constructor(private prisma: PrismaService) {}

  // ── Webhook ingestion ─────────────────────────────────────────────────────
  // Stores the raw payload and auto-creates an Order + KOT for accepted orders.

  async receiveWebhook(platform: string, restaurantId: string, payload: any) {
    const platformOrderId = payload.order_id ?? payload.id ?? `${platform}-${Date.now()}`;

    const existing = await this.prisma.aggregatorOrder.findUnique({
      where: { platformOrderId },
    });
    if (existing) return existing; // idempotent

    const aggOrder = await this.prisma.aggregatorOrder.create({
      data: {
        restaurantId,
        branchId:       payload.branch_id ?? '',   // caller should map
        platform,
        platformOrderId,
        status:         'PENDING',
        rawPayload:     payload,
      },
    });

    return aggOrder;
  }

  // ── List / detail ─────────────────────────────────────────────────────────

  async list(restaurantId: string, platform?: string) {
    return this.prisma.aggregatorOrder.findMany({
      where: {
        restaurantId,
        ...(platform ? { platform } : {}),
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  async findOne(restaurantId: string, id: string) {
    const order = await this.prisma.aggregatorOrder.findFirst({
      where: { id, restaurantId },
    });
    if (!order) throw new NotFoundException('Aggregator order not found');
    return order;
  }

  // ── Accept ────────────────────────────────────────────────────────────────
  // Creates a real Order + KOT in the system, sets status to ACCEPTED.

  async accept(restaurantId: string, id: string, dto: AcceptAggregatorOrderDto) {
    const aggOrder = await this.findOne(restaurantId, id);
    if (aggOrder.status !== 'PENDING') {
      throw new BadRequestException(`Order is already ${aggOrder.status}`);
    }

    const branchId = dto.branchId ?? aggOrder.branchId;
    if (!branchId) throw new BadRequestException('branchId required');

    const payload: any = aggOrder.rawPayload;
    const items: any[]  = payload.items ?? [];

    // Build the NestJS order within a transaction
    const [updatedAgg] = await this.prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          branchId,
          orderType:     'DELIVERY',
          status:        'ACCEPTED',
          customerName:  payload.customer?.name  ?? payload.customer_name  ?? null,
          customerPhone: payload.customer?.phone ?? payload.customer_phone ?? null,
          customerAddress: payload.customer?.address ?? null,
          createdBy:     'aggregator',
          notes:         `${aggOrder.platform.toUpperCase()} order #${aggOrder.platformOrderId}`,
          items: {
            create: items.map((it: any) => ({
              itemName:    it.name ?? it.item_name ?? 'Item',
              unitPrice:   it.price ?? it.unit_price ?? 0,
              quantity:    it.quantity ?? 1,
              taxPercent:  it.tax_percent ?? 0,
              createdAt:   new Date(),
              updatedAt:   new Date(),
            })),
          },
        },
        include: { items: true },
      });

      // Create a KOT for the new items
      const kot = await tx.kot.create({
        data: {
          branchId,
          orderId:    order.id,
          kotNumber:  `KOT-AGG-${Date.now()}`,
          type:       'REGULAR',
          kitchenStation: 'MAIN',
          items: {
            connect: order.items.map((i) => ({ id: i.id })),
          },
        },
      });

      // Link aggregator order → real order
      const updated = await tx.aggregatorOrder.update({
        where: { id: aggOrder.id },
        data:  { status: 'ACCEPTED', orderId: order.id },
      });

      return [updated, order, kot];
    });

    return updatedAgg;
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  async reject(restaurantId: string, id: string, reason?: string) {
    const aggOrder = await this.findOne(restaurantId, id);
    if (aggOrder.status !== 'PENDING') {
      throw new BadRequestException(`Order is already ${aggOrder.status}`);
    }

    return this.prisma.aggregatorOrder.update({
      where: { id },
      data:  { status: 'REJECTED' },
    });
  }
}
