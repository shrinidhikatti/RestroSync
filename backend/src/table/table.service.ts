import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import {
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/table.dto';
import { TableStatus } from '@prisma/client';

@Injectable()
export class TableService {
  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  async getAll(branchId: string) {
    return this.prisma.table.findMany({
      where: { branchId, isActive: true },
      orderBy: [{ floor: 'asc' }, { section: 'asc' }, { number: 'asc' }],
      include: {
        orders: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          select: {
            id: true,
            status: true,
            orderType: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
          take: 1,
        },
        reservations: {
          where: {
            reservationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            status: 'CONFIRMED',
          },
          orderBy: { reservationTime: 'asc' },
        },
      },
    });
  }

  async getOne(branchId: string, id: string) {
    const table = await this.prisma.table.findFirst({
      where: { id, branchId },
      include: {
        orders: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          include: {
            items: { where: { status: { not: 'VOIDED' } } },
          },
        },
        reservations: {
          where: { status: { in: ['CONFIRMED', 'SEATED'] } },
          orderBy: { reservationDate: 'asc' },
        },
      },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async create(branchId: string, dto: CreateTableDto) {
    const existing = await this.prisma.table.findUnique({
      where: { branchId_number: { branchId, number: dto.number } },
    });
    if (existing) throw new ConflictException('Table number already exists');

    return this.prisma.table.create({
      data: { branchId, ...dto },
    });
  }

  async update(branchId: string, id: string, dto: UpdateTableDto) {
    const table = await this.prisma.table.findFirst({ where: { id, branchId } });
    if (!table) throw new NotFoundException('Table not found');

    if (dto.number && dto.number !== table.number) {
      const existing = await this.prisma.table.findUnique({
        where: { branchId_number: { branchId, number: dto.number } },
      });
      if (existing) throw new ConflictException('Table number already exists');
    }

    return this.prisma.table.update({ where: { id }, data: dto });
  }

  async updateStatus(branchId: string, id: string, dto: UpdateTableStatusDto) {
    const table = await this.prisma.table.findFirst({ where: { id, branchId } });
    if (!table) throw new NotFoundException('Table not found');

    const data: any = { status: dto.status };
    if (dto.status === TableStatus.OCCUPIED) {
      data.occupiedSince = new Date();
    } else if (dto.status === TableStatus.AVAILABLE) {
      data.occupiedSince = null;
    }

    const updated = await this.prisma.table.update({ where: { id }, data });

    // Emit real-time update to branch clients
    this.gateway.emitToBranch(branchId, 'table:status_updated', {
      tableId: id,
      status: dto.status,
    });

    return updated;
  }

  async delete(branchId: string, id: string) {
    const table = await this.prisma.table.findFirst({
      where: { id, branchId },
      include: {
        orders: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
      },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (table.orders.length > 0) {
      throw new BadRequestException('Cannot delete table with active orders');
    }

    // Soft delete
    await this.prisma.table.update({ where: { id }, data: { isActive: false } });
    return { message: 'Table deactivated' };
  }

  // Called by the reservation scheduler
  async markNoOrderAlert(branchId: string, tableId: string) {
    this.gateway.emitToBranch(branchId, 'table:no_order_alert', { tableId });
  }
}
