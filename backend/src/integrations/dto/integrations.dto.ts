import { IsString, IsOptional, IsBoolean, IsNumber, IsPositive, IsArray } from 'class-validator';

// ─── Integration Config ──────────────────────────────────────────────────────

export class UpdateIntegrationConfigDto {
  @IsOptional() @IsString() razorpayKeyId?: string;
  @IsOptional() @IsString() razorpayKeySecret?: string;
  @IsOptional() @IsString() razorpayWebhookSecret?: string;
  @IsOptional() @IsString() stripePublishableKey?: string;
  @IsOptional() @IsString() stripeSecretKey?: string;
  @IsOptional() @IsString() stripeWebhookSecret?: string;
  @IsOptional() @IsString() upiVpa?: string;
  @IsOptional() @IsString() smsProvider?: string;
  @IsOptional() @IsString() smsApiKey?: string;
  @IsOptional() @IsString() smsSenderId?: string;
  @IsOptional() @IsString() whatsappApiUrl?: string;
  @IsOptional() @IsString() whatsappToken?: string;
  @IsOptional() @IsBoolean() zomatoEnabled?: boolean;
  @IsOptional() @IsString() zomatoRestaurantId?: string;
  @IsOptional() @IsBoolean() swiggyEnabled?: boolean;
  @IsOptional() @IsString() swiggyRestaurantId?: string;
}

// ─── Payment Gateway ──────────────────────────────────────────────────────────

export class CreateRazorpayOrderDto {
  @IsNumber() @IsPositive()
  amount: number;       // in rupees (service converts to paise)

  @IsString()
  billId: string;

  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerPhone?: string;
}

export class CreateUpiQrDto {
  @IsNumber() @IsPositive()
  amount: number;

  @IsString()
  billId: string;

  @IsOptional() @IsString()
  note?: string;
}

// ─── SMS / Notification ───────────────────────────────────────────────────────

export class SendSmsDto {
  @IsString()
  phone: string;

  @IsString()
  message: string;
}

export class SendBillWhatsAppDto {
  @IsString()
  phone: string;

  @IsString()
  billId: string;
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

export class AcceptAggregatorOrderDto {
  @IsOptional() @IsString()
  branchId?: string;
}

// ─── Split Bill ───────────────────────────────────────────────────────────────

export class SplitBillDto {
  @IsString()
  orderId: string;

  @IsString() // 'EQUAL' | 'BY_ITEM'
  splitType: string;

  @IsOptional() @IsNumber() @IsPositive()
  splitCount?: number;   // for EQUAL split

  @IsOptional() @IsArray()
  itemGroups?: { itemIds: string[] }[];  // for BY_ITEM split
}

// ─── Table Operations ─────────────────────────────────────────────────────────

export class TransferTableDto {
  @IsString()
  orderId: string;

  @IsString()
  toTableId: string;
}

export class MergeTablesDto {
  @IsArray() @IsString({ each: true })
  orderIds: string[];   // source orders to merge INTO the first order
}

// ─── Device ───────────────────────────────────────────────────────────────────

export class RegisterDeviceDto {
  @IsString()
  name: string;

  @IsString()
  branchId: string;

  @IsOptional() @IsString()
  deviceFingerprint?: string;
}

export class UpdateDeviceDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
