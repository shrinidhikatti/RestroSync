import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all active KOTs for the KDS with their items.
   * Groups items under each KOT, filtered to non-served/non-voided.
   */
  async getActiveKots(branchId: string, station?: string) {
    const kots = await this.prisma.kot.findMany({
      where: {
        branchId,
        ...(station ? { kitchenStation: station } : {}),
        order: {
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        items: {
          some: {
            status: { notIn: ['SERVED', 'VOIDED'] },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          select: {
            id: true,
            orderType: true,
            status: true,
            priority: true,
            tokenNumber: true,
            customerName: true,
            notes: true,
            table: { select: { number: true, section: true } },
          },
        },
        items: {
          where: { status: { notIn: ['SERVED', 'VOIDED'] } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return kots;
  }

  /**
   * Get a KDS summary: count of new, preparing, and ready orders.
   */
  async getKdsSummary(branchId: string) {
    const [newCount, preparingCount, readyCount] = await Promise.all([
      this.prisma.order.count({ where: { branchId, status: 'NEW' } }),
      this.prisma.order.count({ where: { branchId, status: 'PREPARING' } }),
      this.prisma.order.count({ where: { branchId, status: 'READY' } }),
    ]);

    return { new: newCount, preparing: preparingCount, ready: readyCount };
  }
}
