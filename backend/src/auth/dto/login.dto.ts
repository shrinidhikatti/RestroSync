import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'owner@restaurant.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class PinLoginDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @MinLength(4)
  pin!: string;

  @ApiProperty({ example: 'device-uuid' })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'My Restaurant' })
  @IsString()
  @IsNotEmpty()
  restaurantName!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @ApiProperty({ example: 'owner@restaurant.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  dpdpaConsent?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class RegisterDeviceDto {
  @ApiProperty({ example: 'Billing Counter 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
