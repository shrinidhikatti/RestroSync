import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { CreateReservationDto, UpdateReservationDto } from './dto/table.dto';
import { ReservationStatus } from '@prisma/client';

@Injectable()
export class ReservationService implements OnModuleInit, OnModuleDestroy {
  private schedulerInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  onModuleInit() {
    // Check every 5 minutes for no-show reservations (past 30min with no seat)
    this.schedulerInterval = setInterval(() => {
      this.markNoShows().catch(console.error);
    }, 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }

  private async markNoShows() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find confirmed reservations whose time has passed by 30+ minutes
    const overdueReservations = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        createdAt: { lt: thirtyMinutesAgo }, // simple proxy; ideally compare reservationDate+Time
      },
      include: { branch: true },
    });

    for (const reservation of overdueReservations) {
      const [hours, minutes] = reservation.reservationTime.split(':').map(Number);
      const reservationDateTime = new Date(reservation.reservationDate);
      reservationDateTime.setHours(hours, minutes, 0, 0);
      const cutoff = new Date(reservationDateTime.getTime() + 30 * 60 * 1000);

      if (new Date() > cutoff) {
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.NO_SHOW },
        });

        this.gateway.emitToBranch(reservation.branchId, 'reservation:no_show', {
          reservationId: reservation.id,
          tableId: reservation.tableId,
          customerName: reservation.customerName,
        });
      }
    }
  }

  async getAll(branchId: string, date?: string) {
    const whereDate = date ? new Date(date) : undefined;

    return this.prisma.reservation.findMany({
      where: {
        branchId,
        ...(whereDate && { reservationDate: whereDate }),
      },
      include: {
        table: { select: { id: true, number: true, section: true, floor: true } },
      },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
    });
  }

  async getOne(branchId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, branchId },
      include: { table: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async create(branchId: string, userId: string, dto: CreateReservationDto) {
    // Verify table belongs to branch
    const table = await this.prisma.table.findFirst({
      where: { id: dto.tableId, branchId },
    });
    if (!table) throw new NotFoundException('Table not found in this branch');

    // Check for conflicting reservations on that date/time slot
    const conflicting = await this.prisma.reservation.findFirst({
      where: {
        tableId: dto.tableId,
        reservationDate: new Date(dto.reservationDate),
        reservationTime: dto.reservationTime,
        status: { in: ['CONFIRMED', 'SEATED'] },
      },
    });
    if (conflicting) {
      throw new BadRequestException('Table already reserved for this time slot');
    }

    return this.prisma.reservation.create({
      data: {
        branchId,
        tableId: dto.tableId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        partySize: dto.partySize,
        reservationDate: new Date(dto.reservationDate),
        reservationTime: dto.reservationTime,
        endTime: dto.endTime,
        notes: dto.notes,
        createdBy: userId,
      },
      include: { table: true },
    });
  }

  async update(branchId: string, id: string, dto: UpdateReservationDto) {
    await this.getOne(branchId, id);

    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, branchId },
      });
      if (!table) throw new NotFoundException('Table not found in this branch');
    }

    const data: any = { ...dto };
    if (dto.reservationDate) {
      data.reservationDate = new Date(dto.reservationDate);
    }

    return this.prisma.reservation.update({
      where: { id },
      data,
      include: { table: true },
    });
  }

  async cancel(branchId: string, id: string) {
    const reservation = await this.getOne(branchId, id);

    if (reservation.status === ReservationStatus.SEATED) {
      throw new BadRequestException('Cannot cancel a seated reservation');
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  async seat(branchId: string, id: string) {
    const reservation = await this.getOne(branchId, id);

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed reservations can be seated');
    }

    // Update reservation status + table status
    const [updatedReservation] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id },
        data: { status: ReservationStatus.SEATED },
      }),
      this.prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'OCCUPIED', occupiedSince: new Date() },
      }),
    ]);

    this.gateway.emitToBranch(branchId, 'table:status_updated', {
      tableId: reservation.tableId,
      status: 'OCCUPIED',
    });

    return updatedReservation;
  }
}
