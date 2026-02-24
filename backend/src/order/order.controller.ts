import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { KotService } from './kot.service';
import { BillService } from './bill.service';
import { PaymentService } from './payment.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import {
  CreateOrderDto, UpdateOrderDto, CancelOrderDto,
  AddOrderItemDto, UpdateOrderItemDto, VoidOrderItemDto,
  GenerateKotDto, GenerateBillDto, VoidBillDto,
  RecordPaymentDto, CreateRefundDto, UpdateRefundStatusDto,
} from './dto/order.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly kotService: KotService,
    private readonly billService: BillService,
    private readonly paymentService: PaymentService,
  ) {}

  // ─── Orders ───────────────────────────────────────────────────────────────────

  @Post('orders')
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(user.branchId!, user.userId, user.name, user.restaurantId!, dto);
  }

  @Get('orders')
  getOrders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('tableId') tableId?: string,
    @Query('date') date?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.orderService.getOrders(user.branchId!, { status, type, tableId, date, limit, offset });
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orderService.getOrderById(id, user.branchId!);
  }

  @Patch('orders/:id')
  updateOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, user.branchId!, dto);
  }

  @Patch('orders/:id/cancel')
  cancelOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orderService.cancelOrder(id, user.branchId!, user.userId, dto);
  }

  // ─── Shift Handover ───────────────────────────────────────────────────────────

  // GET /orders/handover/my-orders — active orders owned by current captain
  @Get('orders/handover/my-orders')
  getMyCaptainOrders(@CurrentUser() user: JwtPayload) {
    return this.orderService.getCaptainActiveOrders(user.userId, user.branchId!);
  }

  // POST /orders/handover/reassign — bulk-reassign to another captain
  @Post('orders/handover/reassign')
  reassignOrders(
    @CurrentUser() user: JwtPayload,
    @Body() body: { toCaptainId: string; orderIds?: string[] },
  ) {
    return this.orderService.reassignOrders(user.userId, body.toCaptainId, user.branchId!, body.orderIds);
  }

  // GET /orders/handover/active-captains — who has active orders right now
  @Get('orders/handover/active-captains')
  getActiveCaptains(@CurrentUser() user: JwtPayload) {
    return this.orderService.getActiveCaptains(user.branchId!);
  }

  // ─── Order Items ──────────────────────────────────────────────────────────────

  @Post('orders/:id/items')
  addItems(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddOrderItemDto | AddOrderItemDto[]) {
    const items = Array.isArray(dto) ? dto : [dto];
    return this.orderService.addItems(id, user.branchId!, user.restaurantId!, items);
  }

  @Patch('orders/:id/items/:itemId')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.orderService.updateOrderItem(id, itemId, user.branchId!, dto);
  }

  @Delete('orders/:id/items/:itemId')
  voidItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: VoidOrderItemDto,
  ) {
    return this.orderService.voidOrderItem(id, itemId, user.branchId!, user.userId, dto);
  }

  // ─── KOT ─────────────────────────────────────────────────────────────────────

  @Post('orders/:id/kot')
  generateKot(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: GenerateKotDto) {
    return this.kotService.generateKot(id, user.branchId!, dto);
  }

  @Get('orders/:id/kots')
  getOrderKots(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.kotService.getOrderKots(id, user.branchId!);
  }

  @Post('kots/:kotId/reprint')
  reprintKot(@CurrentUser() user: JwtPayload, @Param('kotId') kotId: string) {
    return this.kotService.reprintKot(kotId, user.branchId!);
  }

  @Patch('order-items/:itemId/status')
  updateItemStatus(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
    @Body('status') status: string,
  ) {
    return this.kotService.updateItemStatus(itemId, user.branchId!, status);
  }

  // ─── Bill ─────────────────────────────────────────────────────────────────────

  @Post('orders/:id/bill')
  generateBill(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: GenerateBillDto) {
    return this.billService.generateBill(id, user.branchId!, user.restaurantId!, user.userId, dto);
  }

  @Get('bills/:billId')
  getBill(@CurrentUser() user: JwtPayload, @Param('billId') billId: string) {
    return this.billService.getBill(billId, user.branchId!);
  }

  @Post('bills/:billId/void')
  voidBill(@CurrentUser() user: JwtPayload, @Param('billId') billId: string, @Body() dto: VoidBillDto) {
    return this.billService.voidBill(billId, user.branchId!, user.userId, dto);
  }

  @Post('bills/:billId/print')
  incrementPrint(@CurrentUser() user: JwtPayload, @Param('billId') billId: string) {
    return this.billService.incrementPrintCount(billId, user.branchId!);
  }

  // ─── Payments ─────────────────────────────────────────────────────────────────

  @Post('bills/:billId/payments')
  recordPayment(@CurrentUser() user: JwtPayload, @Param('billId') billId: string, @Body() dto: RecordPaymentDto) {
    return this.paymentService.recordPayment(billId, user.branchId!, user.userId, dto);
  }

  @Get('bills/:billId/payments')
  getPayments(@CurrentUser() user: JwtPayload, @Param('billId') billId: string) {
    return this.paymentService.getPayments(billId, user.branchId!);
  }

  // ─── Refunds ──────────────────────────────────────────────────────────────────

  @Post('bills/:billId/refunds')
  createRefund(@CurrentUser() user: JwtPayload, @Param('billId') billId: string, @Body() dto: CreateRefundDto) {
    return this.paymentService.createRefund(billId, user.branchId!, user.userId, dto);
  }

  @Get('bills/:billId/refunds')
  getRefunds(@CurrentUser() user: JwtPayload, @Param('billId') billId: string) {
    return this.paymentService.getRefunds(billId, user.branchId!);
  }

  @Patch('refunds/:refundId')
  updateRefundStatus(
    @CurrentUser() user: JwtPayload,
    @Param('refundId') refundId: string,
    @Body() dto: UpdateRefundStatusDto,
  ) {
    return this.paymentService.updateRefundStatus(refundId, user.branchId!, user.userId, dto);
  }
}
