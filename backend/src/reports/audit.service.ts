import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // ── Write an audit log entry ──────────────────────────────────────────────────

  async log(entry: {
    restaurantId?: string;
    branchId?:     string;
    userId:        string;
    action:        string;   // e.g. 'order:cancelled', 'bill:voided', 'discount:applied'
    entity:        string;   // e.g. 'order', 'bill'
    entityId?:     string;
    oldValue?:     any;
    newValue?:     any;
    ipAddress?:    string;
    deviceId?:     string;
  }) {
    return this.prisma.auditLog.create({ data: entry });
  }

  // ── Query audit logs with filters ────────────────────────────────────────────

  async getLogs(params: {
    restaurantId?: string;
    branchId?:     string;
    userId?:       string;
    action?:       string;
    entity?:       string;
    entityId?:     string;
    from?:         string;
    to?:           string;
    search?:       string;
    page?:         number;
    limit?:        number;
  }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (params.restaurantId) where.restaurantId = params.restaurantId;
    if (params.branchId)     where.branchId     = params.branchId;
    if (params.userId)       where.userId       = params.userId;
    if (params.entity)       where.entity       = params.entity;
    if (params.entityId)     where.entityId     = params.entityId;

    if (params.action) {
      where.action = { contains: params.action, mode: 'insensitive' };
    }

    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) {
        const end = new Date(params.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (params.search) {
      where.OR = [
        { entityId:   { contains: params.search, mode: 'insensitive' } },
        { action:     { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── Get distinct users who have audit logs ───────────────────────────────────

  async getLogActors(restaurantId: string) {
    const result = await this.prisma.auditLog.findMany({
      where:    { restaurantId },
      select:   { userId: true },
      distinct: ['userId'],
    });
    return result.map((r) => r.userId);
  }

  // ── Action categories for filter dropdown ────────────────────────────────────

  async getActionCategories(restaurantId: string) {
    const result = await this.prisma.auditLog.findMany({
      where:    { restaurantId },
      select:   { action: true },
      distinct: ['action'],
      orderBy:  { action: 'asc' },
    });
    return result.map((r) => r.action);
  }
}
