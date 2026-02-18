import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Res, RawBodyRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';

import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { PaymentGatewayService } from './payment-gateway.service';
import { AggregatorService }     from './aggregator.service';
import { NotificationService }   from './notification.service';
import { AccountingService }     from './accounting.service';
import { AdvancedPosService }    from './advanced-pos.service';
import { PrismaService }         from '../prisma/prisma.service';

import {
  UpdateIntegrationConfigDto,
  CreateRazorpayOrderDto,
  CreateUpiQrDto,
  SendSmsDto,
  SendBillWhatsAppDto,
  AcceptAggregatorOrderDto,
  SplitBillDto,
  TransferTableDto,
  MergeTablesDto,
} from './dto/integrations.dto';

@ApiTags('integrations')
@Controller('api/v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly pgService:   PaymentGatewayService,
    private readonly aggService:  AggregatorService,
    private readonly notifSvc:    NotificationService,
    private readonly acctSvc:     AccountingService,
    private readonly advPosSvc:   AdvancedPosService,
  ) {}

  // ── Integration Config ────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('config')
  async getConfig(@CurrentUser() user: JwtPayload) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { restaurantId: user.restaurantId! },
    });
    // Mask secrets in response
    if (!config) return null;
    return {
      ...config,
      razorpayKeySecret:     config.razorpayKeySecret     ? '••••••••' : null,
      razorpayWebhookSecret: config.razorpayWebhookSecret ? '••••••••' : null,
      stripeSecretKey:       config.stripeSecretKey       ? '••••••••' : null,
      stripeWebhookSecret:   config.stripeWebhookSecret   ? '••••••••' : null,
      smsApiKey:             config.smsApiKey             ? '••••••••' : null,
      whatsappToken:         config.whatsappToken         ? '••••••••' : null,
    };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('config')
  async updateConfig(@CurrentUser() user: JwtPayload, @Body() dto: UpdateIntegrationConfigDto) {
    return this.prisma.integrationConfig.upsert({
      where:  { restaurantId: user.restaurantId! },
      create: { restaurantId: user.restaurantId!, ...dto },
      update: dto,
    });
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('razorpay/orders')
  async createRazorpayOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    return this.pgService.createRazorpayOrder(user.restaurantId!, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('razorpay/verify')
  async verifyRazorpay(
    @CurrentUser() user: JwtPayload,
    @Body() body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    return this.pgService.verifyRazorpayPayment(user.restaurantId!, body);
  }

  // Razorpay webhook — no JWT (called by Razorpay servers)
  @Post('razorpay/webhook/:restaurantId')
  async razorpayWebhook(
    @Param('restaurantId') restaurantId: string,
    @Req() req: RawBodyRequest<any>,
    @Body() _body: any,
  ) {
    const rawBody  = (req.rawBody ?? Buffer.from(JSON.stringify(_body))).toString();
    const sig      = req.headers['x-razorpay-signature'] as string ?? '';
    return this.pgService.handleRazorpayWebhook(restaurantId, rawBody, sig);
  }

  // ── UPI ───────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('upi/qr')
  async generateUpiQr(@CurrentUser() user: JwtPayload, @Body() dto: CreateUpiQrDto) {
    return this.pgService.generateUpiQr(user.restaurantId!, dto);
  }

  // ── Aggregator (Zomato / Swiggy) ─────────────────────────────────────────

  // Inbound webhooks from aggregator platforms — no JWT
  @Post('aggregator/webhook/:platform/:restaurantId')
  async aggregatorWebhook(
    @Param('platform') platform: string,
    @Param('restaurantId') restaurantId: string,
    @Body() payload: any,
  ) {
    return this.aggService.receiveWebhook(platform, restaurantId, payload);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('aggregator/orders')
  async listAggregatorOrders(
    @CurrentUser() user: JwtPayload,
    @Query('platform') platform?: string,
  ) {
    return this.aggService.list(user.restaurantId!, platform);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('aggregator/orders/:id/accept')
  async acceptAggregatorOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AcceptAggregatorOrderDto,
  ) {
    return this.aggService.accept(user.restaurantId!, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('aggregator/orders/:id/reject')
  async rejectAggregatorOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.aggService.reject(user.restaurantId!, id, body.reason);
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('notify/sms')
  async sendSms(@CurrentUser() user: JwtPayload, @Body() dto: SendSmsDto) {
    return this.notifSvc.sendSms(user.restaurantId!, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('notify/whatsapp/bill')
  async sendBillWhatsApp(@CurrentUser() user: JwtPayload, @Body() dto: SendBillWhatsAppDto) {
    return this.notifSvc.sendBillWhatsApp(user.restaurantId!, dto);
  }

  // ── Accounting ────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('accounting/pnl')
  async getPnL(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const toDate   = to   ? new Date(to)   : new Date();
    return this.acctSvc.getPnL(user.restaurantId!, fromDate, toDate);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('accounting/tally-export')
  async tallyExport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const toDate   = to   ? new Date(to)   : new Date();
    const xml = await this.acctSvc.exportTallyXml(user.restaurantId!, fromDate, toDate);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="tally-export.xml"');
    res.send(xml);
  }

  // ── Advanced POS ──────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('pos/split-bill')
  async splitBill(@CurrentUser() user: JwtPayload, @Body() dto: SplitBillDto) {
    return this.advPosSvc.splitBill(user.restaurantId!, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('pos/transfer-table')
  async transferTable(@CurrentUser() user: JwtPayload, @Body() dto: TransferTableDto) {
    return this.advPosSvc.transferTable(user.restaurantId!, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('pos/merge-orders')
  async mergeOrders(@CurrentUser() user: JwtPayload, @Body() dto: MergeTablesDto) {
    return this.advPosSvc.mergeOrders(user.restaurantId!, dto);
  }
}
