import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRazorpayOrderDto, CreateUpiQrDto } from './dto/integrations.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentGatewayService {
  constructor(private prisma: PrismaService) {}

  // ── Config helpers ────────────────────────────────────────────────────────

  private async getConfig(restaurantId: string) {
    return this.prisma.integrationConfig.findUnique({ where: { restaurantId } });
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────
  // Integration is provider-ready: actual HTTP calls to Razorpay API are made
  // when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured.

  async createRazorpayOrder(restaurantId: string, dto: CreateRazorpayOrderDto) {
    const config = await this.getConfig(restaurantId);
    if (!config?.razorpayKeyId || !config.razorpayKeySecret) {
      throw new BadRequestException('Razorpay not configured. Add API keys in Integration Settings.');
    }

    const bill = await this.prisma.bill.findFirst({
      where: { id: dto.billId },
      select: { id: true, grandTotal: true, billNumber: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    // Call Razorpay Orders API
    const amountPaise = Math.round(dto.amount * 100);
    const credentials = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  bill.billNumber,
        notes:    {
          billId:       dto.billId,
          restaurantId,
          customerName: dto.customerName ?? '',
          customerPhone: dto.customerPhone ?? '',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new BadRequestException(`Razorpay error: ${(err as any)?.error?.description ?? response.statusText}`);
    }

    const order: any = await response.json();
    return {
      orderId:      order.id,
      amount:       dto.amount,
      amountPaise,
      currency:     'INR',
      keyId:        config.razorpayKeyId,
      billId:       dto.billId,
      billNumber:   bill.billNumber,
    };
  }

  async verifyRazorpayPayment(restaurantId: string, params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const config = await this.getConfig(restaurantId);
    if (!config?.razorpayKeySecret) throw new BadRequestException('Razorpay not configured');

    const expectedSig = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');

    const valid = expectedSig === params.razorpaySignature;
    return { valid, paymentId: params.razorpayPaymentId };
  }

  // ── UPI QR Code ────────────────────────────────────────────────────────────

  async generateUpiQr(restaurantId: string, dto: CreateUpiQrDto) {
    // First check restaurant's upiVpa config, fallback to upiMerchantId on restaurant
    const [config, restaurant] = await Promise.all([
      this.getConfig(restaurantId),
      this.prisma.restaurant.findUnique({
        where:  { id: restaurantId },
        select: { upiMerchantId: true, name: true },
      }),
    ]);

    const upiVpa = config?.upiVpa ?? restaurant?.upiMerchantId;
    if (!upiVpa) {
      throw new BadRequestException('UPI VPA not configured. Set it in Integration Settings or Restaurant profile.');
    }

    // UPI Deep Link format (works with all UPI apps)
    const upiString = [
      `pa=${encodeURIComponent(upiVpa)}`,
      `pn=${encodeURIComponent(restaurant?.name ?? 'Restaurant')}`,
      `am=${dto.amount.toFixed(2)}`,
      `cu=INR`,
      `tn=${encodeURIComponent(dto.note ?? `Bill ${dto.billId}`)}`,
    ].join('&');

    const upiUrl = `upi://pay?${upiString}`;

    // Return the UPI URL — the frontend renders it as a QR code using a library
    return {
      upiUrl,
      upiVpa,
      amount: dto.amount,
      billId: dto.billId,
    };
  }

  // ── Razorpay Webhook ───────────────────────────────────────────────────────

  async handleRazorpayWebhook(restaurantId: string, rawBody: string, signature: string) {
    const config = await this.getConfig(restaurantId);
    if (!config?.razorpayWebhookSecret) return { ignored: true };

    const expectedSig = crypto
      .createHmac('sha256', config.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody);
    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      return { event: event.event, paymentId: event.payload?.payment?.entity?.id };
    }

    return { event: event.event, status: 'received' };
  }
}
