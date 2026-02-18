import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/inventory.dto';
import { StockService } from './stock.service';

@Injectable()
export class SupplierService {
  constructor(
    private prisma:  PrismaService,
    private stockSvc: StockService,
  ) {}

  // ── Suppliers ────────────────────────────────────────────────────────────────

  async listSuppliers(restaurantId: string) {
    return this.prisma.supplier.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(id: string, restaurantId: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, restaurantId },
    });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  async createSupplier(restaurantId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { restaurantId, ...dto },
    });
  }

  async updateSupplier(id: string, restaurantId: string, dto: UpdateSupplierDto) {
    await this.getSupplier(id, restaurantId);
    return this.prisma.supplier.update({
      where: { id },
      data:  dto,
    });
  }

  async deleteSupplier(id: string, restaurantId: string) {
    await this.getSupplier(id, restaurantId);
    return this.prisma.supplier.update({
      where: { id },
      data:  { isActive: false },
    });
  }

  // ── Purchase Orders ──────────────────────────────────────────────────────────

  async listPurchaseOrders(branchId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { branchId },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchaseOrder(id: string, branchId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, branchId },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async createPurchaseOrder(
    branchId:  string,
    createdBy: string,
    dto:       CreatePurchaseOrderDto,
  ) {
    return this.prisma.purchaseOrder.create({
      data: {
        branchId,
        supplierId:  dto.supplierId,
        totalAmount: dto.totalAmount ?? 0,
        notes:       dto.notes,
        status:      'DRAFT',
        createdBy,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async updatePurchaseOrder(
    id:       string,
    branchId: string,
    dto:      UpdatePurchaseOrderDto,
  ) {
    await this.getPurchaseOrder(id, branchId);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data:  dto,
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Mark PO as received — creates stock batches for each received item.
   */
  async receivePurchaseOrder(
    id:        string,
    branchId:  string,
    createdBy: string,
    dto:       ReceivePurchaseOrderDto,
  ) {
    const po = await this.getPurchaseOrder(id, branchId);
    if (po.status === 'RECEIVED') {
      throw new NotFoundException('Purchase order already received');
    }
    if (po.status === 'CANCELLED') {
      throw new NotFoundException('Cannot receive a cancelled purchase order');
    }

    // Process each item as a stock-in
    for (const item of dto.items) {
      await this.stockSvc.stockIn(branchId, createdBy, {
        ...item,
        purchaseOrderId: id,
        supplierId: (po as any).supplierId,
      });
    }

    // Mark PO as received
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED' },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async cancelPurchaseOrder(id: string, branchId: string) {
    const po = await this.getPurchaseOrder(id, branchId);
    if (po.status === 'RECEIVED') {
      throw new NotFoundException('Cannot cancel a received purchase order');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
