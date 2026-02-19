import { IsEnum, IsOptional, IsString, MinLength, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperatingMode, UserRole } from '@prisma/client';

export class UpdateRestaurantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fssaiNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiMerchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessDayCutoff?: string;
}

export class SetOperatingModeDto {
  @ApiPropertyOptional({ enum: OperatingMode })
  @IsEnum(OperatingMode)
  operatingMode!: OperatingMode;
}

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: ['MANAGER', 'BILLER', 'CAPTAIN', 'KITCHEN'] })
  @IsEnum(['MANAGER', 'BILLER', 'CAPTAIN', 'KITCHEN'])
  role!: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
