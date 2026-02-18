import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ── Clock in ──────────────────────────────────────────────────────────────

  async clockIn(branchId: string, userId: string) {
    // Check if already clocked in (open session without clockOut)
    const open = await this.prisma.staffAttendance.findFirst({
      where: { branchId, userId, clockOut: null },
    });
    if (open) {
      throw new BadRequestException('User already clocked in. Clock out first.');
    }

    return this.prisma.staffAttendance.create({
      data: { branchId, userId, clockIn: new Date() },
    });
  }

  // ── Clock out ─────────────────────────────────────────────────────────────

  async clockOut(branchId: string, attendanceId: string) {
    const record = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, branchId, clockOut: null },
    });
    if (!record) throw new NotFoundException('Open attendance record not found');

    const now        = new Date();
    const diffMs     = now.getTime() - record.clockIn.getTime();
    const totalHours = +(diffMs / 3600000).toFixed(2);

    return this.prisma.staffAttendance.update({
      where: { id: attendanceId },
      data:  { clockOut: now, totalHours },
    });
  }

  // ── Records with filters ──────────────────────────────────────────────────

  async getRecords(branchId: string, opts: {
    userId?: string;
    from?:   string;
    to?:     string;
    page?:   number;
    limit?:  number;
  }) {
    const page  = opts.page  ?? 1;
    const limit = opts.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = { branchId };
    if (opts.userId) where.userId = opts.userId;
    if (opts.from || opts.to) {
      where.clockIn = {};
      if (opts.from) where.clockIn.gte = new Date(opts.from);
      if (opts.to) {
        const end = new Date(opts.to);
        end.setHours(23, 59, 59, 999);
        where.clockIn.lte = end;
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.staffAttendance.count({ where }),
      this.prisma.staffAttendance.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { clockIn: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
    ]);

    return {
      data: records.map((r) => ({
        ...r,
        totalHours:  r.totalHours ? Number(r.totalHours) : null,
        isLate:      this._isLate(r.clockIn),
        isOpen:      !r.clockOut,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── Summary per user for date range ──────────────────────────────────────

  async getSummary(branchId: string, from: string, to: string) {
    const start = new Date(from);
    const end   = new Date(to);
    end.setHours(23, 59, 59, 999);

    const records = await this.prisma.staffAttendance.findMany({
      where:   { branchId, clockIn: { gte: start, lte: end } },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { clockIn: 'asc' },
    });

    // Group by userId
    const byUser: Record<string, {
      user: any; totalHours: number; sessions: number; lateDays: number;
    }> = {};

    for (const r of records) {
      const uid = r.userId;
      if (!byUser[uid]) byUser[uid] = { user: r.user, totalHours: 0, sessions: 0, lateDays: 0 };
      byUser[uid].sessions++;
      byUser[uid].totalHours += r.totalHours ? Number(r.totalHours) : 0;
      if (this._isLate(r.clockIn)) byUser[uid].lateDays++;
    }

    return Object.values(byUser).map((u) => ({
      ...u,
      totalHours: +u.totalHours.toFixed(2),
    }));
  }

  // ── Currently clocked-in staff ────────────────────────────────────────────

  async getOnDuty(branchId: string) {
    return this.prisma.staffAttendance.findMany({
      where:   { branchId, clockOut: null },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { clockIn: 'asc' },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _isLate(clockIn: Date): boolean {
    // "Late" = clocked in after 09:30
    return clockIn.getHours() > 9 || (clockIn.getHours() === 9 && clockIn.getMinutes() > 30);
  }
}
