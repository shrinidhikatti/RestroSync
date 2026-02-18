import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendSmsDto, SendBillWhatsAppDto } from './dto/integrations.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  private async getConfig(restaurantId: string) {
    return this.prisma.integrationConfig.findUnique({ where: { restaurantId } });
  }

  // ── SMS ───────────────────────────────────────────────────────────────────

  async sendSms(restaurantId: string, dto: SendSmsDto) {
    const config = await this.getConfig(restaurantId);
    if (!config?.smsApiKey) {
      throw new BadRequestException('SMS not configured. Add API key in Integration Settings.');
    }

    const provider = (config.smsProvider ?? 'MSG91').toUpperCase();

    if (provider === 'MSG91') {
      const resp = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'authkey':       config.smsApiKey,
        },
        body: JSON.stringify({
          template_id: 'bill_notification',
          sender:      config.smsSenderId ?? 'RSTRNT',
          mobiles:     dto.phone,
          message:     dto.message,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      return { provider, sent: resp.ok, detail: data };
    }

    // Generic HTTP provider (send message as-is)
    const resp = await fetch(`${config.smsApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: dto.phone, message: dto.message }),
    });
    return { provider, sent: resp.ok };
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────

  async sendBillWhatsApp(restaurantId: string, dto: SendBillWhatsAppDto) {
    const config = await this.getConfig(restaurantId);
    if (!config?.whatsappApiUrl || !config.whatsappToken) {
      throw new BadRequestException('WhatsApp not configured.');
    }

    const bill = await this.prisma.bill.findFirst({
      where:   { id: dto.billId },
      include: { order: { include: { items: true } }, payments: true },
    });
    if (!bill) throw new BadRequestException('Bill not found');

    const itemLines = bill.order.items
      .filter((i) => i.status !== 'VOIDED')
      .map((i) => `• ${i.itemName} ×${i.quantity} — ₹${Number(i.unitPrice) * i.quantity}`)
      .join('\n');

    const message = [
      `*Receipt — ${bill.billNumber}*`,
      itemLines,
      `─────────────`,
      `Subtotal: ₹${Number(bill.subtotal).toFixed(2)}`,
      `Tax: ₹${Number(bill.taxTotal).toFixed(2)}`,
      `*Total: ₹${Number(bill.grandTotal).toFixed(2)}*`,
      `\nThank you for dining with us! 🙏`,
    ].join('\n');

    const resp = await fetch(config.whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:      dto.phone,
        type:    'text',
        text:    { body: message },
      }),
    });

    const data = await resp.json().catch(() => ({}));
    return { sent: resp.ok, detail: data };
  }
}
