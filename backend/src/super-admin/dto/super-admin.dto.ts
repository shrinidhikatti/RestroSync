import { IsEmail, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Dosa Corner' })
  @IsString()
  @IsNotEmpty()
  restaurantName!: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @ApiProperty({ example: 'ramesh@dosacorner.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiPropertyOptional({ example: 'Bangalore' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'plan-uuid' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: ['COUNTER', 'TABLE_SIMPLE', 'FULL_SERVICE'], example: 'FULL_SERVICE' })
  @IsOptional()
  @IsString()
  operatingMode?: string;

  @ApiPropertyOptional({ type: [String], example: ['TABLES', 'KDS', 'CRM'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];
}

export class UpdateModulesDto {
  @ApiProperty({ type: [String], example: ['TABLES', 'KDS', 'CRM'] })
  @IsArray()
  @IsString({ each: true })
  modules!: string[];
}

export class ListRestaurantsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['COUNTER', 'TABLE_SIMPLE', 'FULL_SERVICE'] })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
