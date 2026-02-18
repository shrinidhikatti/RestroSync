import { IsString, IsOptional, IsBoolean, IsNumber, IsPositive, IsArray, IsIn } from 'class-validator';

// ─── Menu Push ───────────────────────────────────────────────────────────────

export class PushMenuToBranchDto {
  @IsArray() @IsString({ each: true })
  branchIds: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  categoryIds?: string[];   // push specific categories; omit = push all
}

// ─── Branch Menu Override ─────────────────────────────────────────────────────

export class UpsertBranchOverrideDto {
  @IsString()
  menuItemId: string;

  @IsOptional() @IsBoolean()
  isAvailable?: boolean;

  @IsOptional() @IsNumber() @IsPositive()
  priceOverride?: number;
}

export class BulkBranchOverrideDto {
  @IsArray()
  overrides: UpsertBranchOverrideDto[];
}

// ─── Stock Transfer ───────────────────────────────────────────────────────────

export class CreateStockTransferDto {
  @IsString()
  toBranchId: string;

  @IsString()
  ingredientId: string;

  @IsNumber() @IsPositive()
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateTransferStatusDto {
  @IsString() @IsIn(['COMPLETED', 'CANCELLED'])
  status: string;
}
