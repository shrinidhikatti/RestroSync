import { IsString, IsOptional, IsBoolean, IsEmail, IsNumber, IsPositive, IsDateString, Min } from 'class-validator';

// ─── Customer ────────────────────────────────────────────────────────────────

export class CreateCustomerDto {
  @IsString()
  phone: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsDateString()
  birthday?: string;

  @IsOptional() @IsDateString()
  anniversary?: string;

  @IsOptional() @IsString()
  tags?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsBoolean()
  consentGiven?: boolean;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsDateString()
  birthday?: string;

  @IsOptional() @IsDateString()
  anniversary?: string;

  @IsOptional() @IsString()
  tags?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsBoolean()
  consentGiven?: boolean;
}

// ─── Credit Account ───────────────────────────────────────────────────────────

export class CreateCreditAccountDto {
  @IsString()
  customerId: string;

  @IsOptional() @IsNumber() @IsPositive()
  creditLimit?: number;
}

export class UpdateCreditAccountDto {
  @IsOptional() @IsNumber() @IsPositive()
  creditLimit?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ChargeCreditDto {
  @IsNumber() @IsPositive()
  amount: number;

  @IsOptional() @IsString()
  orderId?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class SettleCreditDto {
  @IsNumber() @IsPositive()
  amount: number;

  @IsString()
  paymentMethod: string;

  @IsOptional() @IsString()
  notes?: string;
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────

export class AdjustLoyaltyDto {
  @IsNumber()
  points: number;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  orderId?: string;
}

export class RedeemLoyaltyDto {
  @IsNumber() @IsPositive()
  points: number;

  @IsOptional() @IsString()
  orderId?: string;
}

export class UpdateLoyaltyConfigDto {
  @IsOptional() @IsNumber() @IsPositive()
  loyaltyPointsPerHundred?: number;

  @IsOptional() @IsNumber() @Min(0)
  loyaltyRedeemValue?: number;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export class ClockInDto {
  @IsString()
  userId: string;

  @IsOptional() @IsString()
  branchId?: string;
}

export class ClockOutDto {
  @IsString()
  attendanceId: string;
}
