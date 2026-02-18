import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Ingredient DTOs ───────────────────────────────────────────────────────────

export class CreateIngredientDto {
  @IsString()
  name: string;

  @IsString()
  unit: string; // KG, LITRE, PIECE, GRAM, ML, etc.

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yieldPercent?: number; // Default 100
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yieldPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Recipe DTOs ───────────────────────────────────────────────────────────────

export class RecipeIngredientDto {
  @IsOptional()
  @IsString()
  ingredientId?: string; // null if using sub-recipe

  @IsOptional()
  @IsString()
  subRecipeId?: string; // null if using direct ingredient

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  unit: string;
}

export class CreateRecipeDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isSubRecipe?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yieldQuantity?: number;

  @IsOptional()
  @IsString()
  yieldUnit?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yieldQuantity?: number;

  @IsOptional()
  @IsString()
  yieldUnit?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];
}

// ─── Stock DTOs ────────────────────────────────────────────────────────────────

export class StockInDto {
  @IsString()
  ingredientId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  costPerUnit: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsDateString()
  purchaseDate: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;
}

export enum ManualStockOutType {
  WASTAGE   = 'WASTAGE',
  STAFF_MEAL = 'WASTAGE', // maps to WASTAGE enum
  ADJUSTMENT = 'ADJUSTMENT',
}

export class ManualStockOutDto {
  @IsString()
  ingredientId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsEnum(['WASTAGE', 'ADJUSTMENT'])
  type: 'WASTAGE' | 'ADJUSTMENT';

  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Supplier DTOs ─────────────────────────────────────────────────────────────

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Purchase Order DTOs ───────────────────────────────────────────────────────

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockInDto)
  items: StockInDto[]; // each received item becomes a stock batch
}
