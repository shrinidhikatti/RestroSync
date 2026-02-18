import {
  IsString, IsEnum, IsOptional, IsInt, IsArray, IsNumber,
  ValidateNested, Min, IsUUID, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ──────────────────────────────────────────────
// Order
// ──────────────────────────────────────────────

export class CreateOrderDto {
  @ApiProperty({ enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'COMPLIMENTARY'] })
  @IsEnum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'COMPLIMENTARY'])
  type!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  complimentaryReason?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  complimentaryNote?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'RUSH', 'VIP'] })
  @IsOptional() @IsEnum(['NORMAL', 'RUSH', 'VIP'])
  priority?: string;
}

export class UpdateOrderDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  customerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'RUSH', 'VIP'] })
  @IsOptional() @IsEnum(['NORMAL', 'RUSH', 'VIP'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  tableId?: string;
}

export class CancelOrderDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

// ──────────────────────────────────────────────
// Order Items
// ──────────────────────────────────────────────

export class AddonInputDto {
  @ApiProperty()
  @IsUUID()
  addonId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  price!: number;
}

export class AddOrderItemDto {
  @ApiProperty()
  @IsUUID()
  menuItemId!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  variantId?: string;

  @ApiProperty()
  @IsInt() @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ type: [AddonInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonInputDto)
  addons?: AddonInputDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'RUSH', 'VIP'] })
  @IsOptional() @IsEnum(['NORMAL', 'RUSH', 'VIP'])
  priority?: string;
}

export class UpdateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional({ enum: ['NORMAL', 'RUSH', 'VIP'] })
  @IsOptional() @IsEnum(['NORMAL', 'RUSH', 'VIP'])
  priority?: string;
}

export class VoidOrderItemDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

// ──────────────────────────────────────────────
// KOT
// ──────────────────────────────────────────────

export class GenerateKotDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  orderItemIds?: string[];
}

// ──────────────────────────────────────────────
// Bill
// ──────────────────────────────────────────────

export class BillDiscountDto {
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  discountId?: string;

  @ApiProperty({ enum: ['FLAT', 'PERCENTAGE'] })
  @IsEnum(['FLAT', 'PERCENTAGE'])
  type!: string;

  @ApiProperty({ enum: ['BILL', 'ITEM', 'CATEGORY'] })
  @IsEnum(['BILL', 'ITEM', 'CATEGORY'])
  scope!: string;

  @ApiProperty()
  @IsNumber() @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  approvedBy?: string;
}

export class GenerateBillDto {
  @ApiPropertyOptional({ type: [BillDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillDiscountDto)
  discounts?: BillDiscountDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(0)
  tipAmount?: number;
}

// ──────────────────────────────────────────────
// Payment
// ──────────────────────────────────────────────

export class PaymentEntryDto {
  @ApiProperty({ enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'CREDIT', 'TIP'] })
  @IsEnum(['CASH', 'CARD', 'UPI', 'WALLET', 'CREDIT', 'TIP'])
  method!: string;

  @ApiProperty()
  @IsNumber() @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  splitLabel?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ type: [PaymentEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentEntryDto)
  payments!: PaymentEntryDto[];
}

// ──────────────────────────────────────────────
// Void Bill
// ──────────────────────────────────────────────

export class VoidBillDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  cashReturned?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  verifiedBy?: string;
}

// ──────────────────────────────────────────────
// Refund
// ──────────────────────────────────────────────

export class RefundItemInputDto {
  @ApiProperty()
  @IsUUID()
  orderItemId!: string;

  @ApiProperty()
  @IsInt() @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reason?: string;
}

export class CreateRefundDto {
  @ApiProperty({ enum: ['FULL', 'PARTIAL'] })
  @IsEnum(['FULL', 'PARTIAL'])
  type!: string;

  @ApiProperty()
  @IsNumber() @Min(0)
  amount!: number;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty()
  @IsString()
  refundMethod!: string;

  @ApiPropertyOptional({ type: [RefundItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemInputDto)
  items?: RefundItemInputDto[];
}

export class UpdateRefundStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'COMPLETED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'COMPLETED', 'REJECTED'])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}
