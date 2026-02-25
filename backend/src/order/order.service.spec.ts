import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ── Mock PrismaService ────────────────────────────────────────────────────────
// Add every model method the service could call to prevent "undefined" errors.
const mockPrisma: any = {
  restaurant:   { findUnique: jest.fn(), findFirst: jest.fn() },
  order:        { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  orderItem:    { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), create: jest.fn() },
  bill:         { findFirst: jest.fn() },
  table:        { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  branch:       { findFirst: jest.fn() },
  menuItem:     { findFirst: jest.fn() },
  discount:     { findMany: jest.fn(), update: jest.fn() },
  orderDiscount:{ create: jest.fn(), deleteMany: jest.fn() },
  kot:          { create: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  numberRange:  { findFirst: jest.fn(), update: jest.fn() },
  auditLog:     { create: jest.fn() },
  fraudAlertConfig: { findFirst: jest.fn() },
  discountConfig:   { findFirst: jest.fn() },
  $transaction: jest.fn((fn: (p: any) => any) => fn(mockPrisma)),
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  // ── Business date logic ────────────────────────────────────────────────────

  describe('getBusinessDate (private)', () => {
    it('returns today at midnight for mid-day calls', () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-03-15T14:00:00'));
      const result = (service as any).getBusinessDate() as Date;
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(0);
      jest.useRealTimers();
    });

    it('rolls back to previous day before 05:00 cutoff', () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-03-15T03:30:00'));
      const result = (service as any).getBusinessDate() as Date;
      expect(result.getDate()).toBe(14);
      jest.useRealTimers();
    });

    it('does NOT roll back exactly at 05:00', () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-03-15T05:00:00'));
      const result = (service as any).getBusinessDate() as Date;
      expect(result.getDate()).toBe(15);
      jest.useRealTimers();
    });
  });

  // ── Cancel order ─────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('throws NotFoundException when order not in branch', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelOrder('order-99', 'branch-1', 'user-1', { reason: 'test' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is COMPLETED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1', status: 'COMPLETED', tableId: null,
      });
      await expect(
        service.cancelOrder('order-1', 'branch-1', 'user-1', { reason: 'test' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancels an order in NEW status and frees the table', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1', status: 'NEW', tableId: 'table-1',
      });
      mockPrisma.bill.findFirst.mockResolvedValue(null);   // no paid bill
      mockPrisma.bill.updateMany = jest.fn().mockResolvedValue({});
      mockPrisma.orderItem.updateMany.mockResolvedValue({});
      mockPrisma.order.count = jest.fn().mockResolvedValue(0);
      mockPrisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });
      mockPrisma.table.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result: any = await service.cancelOrder('order-1', 'branch-1', 'user-1', { reason: 'mistake' } as any);
      expect(result.message).toContain('cancelled');
      expect(mockPrisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'table-1' } }),
      );
    });
  });
});
