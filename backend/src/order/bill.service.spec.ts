import { Test, TestingModule } from '@nestjs/testing';
import { BillService } from './bill.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppGateway } from '../gateway/app.gateway';

const mockGateway = { emitToBranch: jest.fn(), server: { to: jest.fn().mockReturnThis(), emit: jest.fn() } };

const mockPrisma: any = {
  bill:         { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  order:        { findFirst: jest.fn(), update: jest.fn() },
  orderItem:    { findMany: jest.fn() },
  payment:      { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  chargeConfig: { findMany: jest.fn() },
  numberRange:  { findFirst: jest.fn(), update: jest.fn() },
  table:        { update: jest.fn() },
  discountConfig: { findFirst: jest.fn() },
  auditLog:     { create: jest.fn() },
  voidCashReturn: { create: jest.fn() },
  $transaction: jest.fn((fn: (p: any) => any) => fn(mockPrisma)),
};

describe('BillService', () => {
  let service: BillService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AppGateway,    useValue: mockGateway },
      ],
    }).compile();

    service = module.get<BillService>(BillService);
    jest.clearAllMocks();
  });

  // ── Financial year (inline logic from bill.service.ts) ────────────────────

  describe('financial year logic', () => {
    // FY = if month >= 3 (April=3 in 0-based): currentYear-nextYear else prevYear-currentYear
    function computeFy(date: Date): string {
      const now = date;
      return now.getMonth() >= 3
        ? `${now.getFullYear()}-${now.getFullYear() + 1}`
        : `${now.getFullYear() - 1}-${now.getFullYear()}`;
    }

    it('April starts a new FY', () => {
      expect(computeFy(new Date('2025-04-01'))).toBe('2025-2026');
    });

    it('January is previous FY', () => {
      expect(computeFy(new Date('2025-01-15'))).toBe('2024-2025');
    });

    it('March is still previous FY', () => {
      expect(computeFy(new Date('2025-03-31'))).toBe('2024-2025');
    });

    it('December is current FY', () => {
      expect(computeFy(new Date('2025-12-01'))).toBe('2025-2026');
    });
  });

  // ── Generate bill ──────────────────────────────────────────────────────────

  describe('generateBill', () => {
    it('throws NotFoundException when order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(
        service.generateBill('order-99', 'branch-1', 'rest-1', 'user-1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order has no active items', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1', status: 'ACCEPTED', branchId: 'branch-1',
        items: [],                // no active items
      });
      mockPrisma.chargeConfig.findMany.mockResolvedValue([]);
      await expect(
        service.generateBill('order-1', 'branch-1', 'rest-1', 'user-1', {} as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Void bill ──────────────────────────────────────────────────────────────

  describe('voidBill', () => {
    it('throws NotFoundException when bill not found', async () => {
      mockPrisma.bill.findFirst.mockResolvedValue(null);
      await expect(
        service.voidBill('bill-99', 'branch-1', 'user-1', { reason: 'error' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if bill is already VOID', async () => {
      mockPrisma.bill.findFirst.mockResolvedValue({
        id: 'bill-1', isVoid: true, status: 'VOID',
        orderId: 'order-1', payments: [],
      });
      await expect(
        service.voidBill('bill-1', 'branch-1', 'user-1', { reason: 'error' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
