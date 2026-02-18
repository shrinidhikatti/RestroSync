import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockTransferDto, UpdateTransferStatusDto } from './dto/multi-outlet.dto';

@Injectable()
export class StockTransferService {
  constructor(private prisma: PrismaService) {}

  async create(fromBranchId: string, dto: CreateStockTransferDto, createdBy: string) {
    // Verify from-branch has enough stock
    const stock = await this.prisma.stock.findUnique({
      where: { branchId_ingredientId: { branchId: fromBranchId, ingredientId: dto.ingredientId } },
    });

    if (!stock || Number(stock.currentQuantity) < dto.quantity) {
      const available = stock ? Number(stock.currentQuantity) : 0;
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}`,
      );
    }

    return this.prisma.stockTransfer.create({
      data: {
        fromBranchId,
        toBranchId:    dto.toBranchId,
        ingredientId:  dto.ingredientId,
        quantity:      dto.quantity,
        unit:          dto.unit,
        notes:         dto.notes,
        status:        'PENDING',
        createdBy,
      },
      include: {
        fromBranch: { select: { name: true } },
        toBranch:   { select: { name: true } },
      },
    });
  }

  async list(restaurantId: string, branchId?: string) {
    // Get all branch IDs for this restaurant
    const branches = await this.prisma.branch.findMany({
      where:  { restaurantId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const where: any = {
      OR: [
        { fromBranchId: { in: branchIds } },
        { toBranchId:   { in: branchIds } },
      ],
    };
    if (branchId) {
      where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
    }

    return this.prisma.stockTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { name: true } },
        toBranch:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    transferId: string,
    fromBranchId: string,
    dto: UpdateTransferStatusDto,
  ) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer || transfer.fromBranchId !== fromBranchId) {
      throw new NotFoundException('Transfer not found');
    }
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Transfer already completed or cancelled');
    }

    if (dto.status === 'COMPLETED') {
      // Deduct from source, add to destination
      await this.prisma.$transaction([
        // Deduct from source branch
        this.prisma.stock.update({
          where: { branchId_ingredientId: { branchId: transfer.fromBranchId, ingredientId: transfer.ingredientId } },
          data:  { currentQuantity: { decrement: transfer.quantity } },
        }),
        // Upsert to destination branch
        this.prisma.stock.upsert({
          where:  { branchId_ingredientId: { branchId: transfer.toBranchId, ingredientId: transfer.ingredientId } },
          create: {
            branchId:        transfer.toBranchId,
            ingredientId:    transfer.ingredientId,
            currentQuantity: transfer.quantity,
          },
          update: { currentQuantity: { increment: transfer.quantity } },
        }),
        // Create stock transactions
        this.prisma.stockTransaction.create({
          data: {
            branchId:     transfer.fromBranchId,
            ingredientId: transfer.ingredientId,
            type:         'TRANSFER',
            quantity:     Number(transfer.quantity),
            reason:       `Transfer OUT to branch ${transfer.toBranchId} (transfer ${transfer.id})`,
            createdBy:    transfer.createdBy,
          },
        }),
        this.prisma.stockTransaction.create({
          data: {
            branchId:     transfer.toBranchId,
            ingredientId: transfer.ingredientId,
            type:         'TRANSFER',
            quantity:     Number(transfer.quantity),
            reason:       `Transfer IN from branch ${transfer.fromBranchId} (transfer ${transfer.id})`,
            createdBy:    transfer.createdBy,
          },
        }),
        // Mark transfer complete
        this.prisma.stockTransfer.update({
          where: { id: transferId },
          data:  { status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);
    } else {
      // CANCELLED
      await this.prisma.stockTransfer.update({
        where: { id: transferId },
        data:  { status: 'CANCELLED' },
      });
    }

    return this.prisma.stockTransfer.findUnique({
      where:   { id: transferId },
      include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
    });
  }
}
