import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';

// ─── Category DTOs ──────────────────────────────────────────────

export class CreateCategoryDto {
  @ApiProperty({ example: 'Starters' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderCategoriesDto {
  @ApiProperty({ description: 'Array of { id, sortOrder }' })
  @IsArray()
  items: { id: string; sortOrder: number }[];
}

// ─── Menu Item DTOs ─────────────────────────────────────────────

export class CreateMenuItemDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Paneer Tikka' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'P.Tikka' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 249.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'VEG', enum: ['VEG', 'NON_VEG', 'EGG'] })
  @IsOptional()
  @IsEnum(['VEG', 'NON_VEG', 'EGG'])
  foodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxGroupId?: string;

  @ApiPropertyOptional({
    example: 'KITCHEN',
    enum: ['KITCHEN', 'BAR', 'DESSERT'],
  })
  @IsOptional()
  @IsString()
  kitchenStation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['VEG', 'NON_VEG', 'EGG'])
  foodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kitchenStation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class ToggleAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isAvailable: boolean;
}

// ─── Variant DTOs ───────────────────────────────────────────────

export class CreateVariantDto {
  @ApiProperty({ example: 'Half' })
  @IsString()
  name: string;

  @ApiProperty({ example: 149.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Addon DTOs ─────────────────────────────────────────────────

export class CreateAddonDto {
  @ApiProperty({ example: 'Extra Cheese' })
  @IsString()
  name: string;

  @ApiProperty({ example: 30.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateAddonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Price Override DTOs ─────────────────────────────────────────

export class CreatePriceOverrideDto {
  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ example: 199.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;
}

// ─── Combo Item DTOs ─────────────────────────────────────────────

export class ComboEntryDto {
  @ApiProperty()
  @IsUUID()
  menuItemId: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateComboItemDto {
  @ApiProperty({ example: 'Lunch Combo' })
  @IsString()
  name: string;

  @ApiProperty({ example: 199.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ type: [ComboEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboEntryDto)
  entries: ComboEntryDto[];
}

export class UpdateComboItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ComboEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboEntryDto)
  entries?: ComboEntryDto[];
}

// ─── CSV Import ──────────────────────────────────────────────────

export class CsvImportRowDto {
  @IsString()
  category: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  foodType?: string;

  @IsOptional()
  @IsString()
  kitchenStation?: string;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class ImportMenuCsvDto {
  @ApiProperty({ description: 'Parsed CSV rows from papaparse' })
  @IsArray()
  rows: CsvImportRowDto[];
}
