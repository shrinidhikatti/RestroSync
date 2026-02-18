import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, DiscountScope } from '@prisma/client';

export class CreateDiscountDto {
  @ApiProperty({ example: 'HAPPY10' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Happy Hour 10% Off' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({ enum: DiscountScope })
  @IsEnum(DiscountScope)
  scope: DiscountScope;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: 500, description: 'Maximum discount cap (for PERCENTAGE)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({ example: 200, description: 'Minimum order value to apply discount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({ description: 'Usage limit per customer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerCustomer?: number;

  @ApiPropertyOptional({ description: 'Total usage limit across all customers' })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalUsageLimit?: number;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ description: 'Happy hour start time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  happyHourStart?: string;

  @ApiPropertyOptional({ description: 'Happy hour end time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  happyHourEnd?: string;

  @ApiPropertyOptional({
    description: 'Days of week for happy hour (0=Sun, 1=Mon, ..., 6=Sat)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  happyHourDays?: number[];

  @ApiPropertyOptional({ description: 'Category IDs this discount applies to (CATEGORY scope)' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableCategoryIds?: string[];

  @ApiPropertyOptional({ description: 'Item IDs this discount applies to (ITEM scope)' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableItemIds?: string[];
}

export class UpdateDiscountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerCustomer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalUsageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  happyHourStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  happyHourEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  happyHourDays?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableCategoryIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableItemIds?: string[];
}

export class ValidateDiscountDto {
  @ApiProperty({ example: 'HAPPY10' })
  @IsString()
  code: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  orderTotal: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdateDiscountConfigDto {
  @ApiPropertyOptional({ description: 'Allow stacking multiple discounts' })
  @IsOptional()
  @IsBoolean()
  allowStackingDiscounts?: boolean;

  @ApiPropertyOptional({ description: 'Max discount percentage per bill (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxBillDiscountPercent?: number;

  @ApiPropertyOptional({ description: 'Require manager approval for discounts above this amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvalThreshold?: number;
}

export class UpdateFraudAlertConfigDto {
  @ApiPropertyOptional({ description: 'Alert if single discount exceeds this amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  singleDiscountThreshold?: number;

  @ApiPropertyOptional({ description: 'Alert if total discounts per day exceed this amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyDiscountThreshold?: number;

  @ApiPropertyOptional({ description: 'Enable/disable fraud alerts' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
