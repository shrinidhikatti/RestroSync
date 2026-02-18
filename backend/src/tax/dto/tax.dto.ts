import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxComponentType } from '@prisma/client';

export class CreateTaxComponentDto {
  @ApiProperty({ enum: TaxComponentType })
  @IsEnum(TaxComponentType)
  type: TaxComponentType;

  @ApiProperty({ example: 9 })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}

export class CreateTaxGroupDto {
  @ApiProperty({ example: 'GST 5%' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Standard restaurant GST' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateTaxComponentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTaxComponentDto)
  components: CreateTaxComponentDto[];
}

export class UpdateTaxGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CreateTaxComponentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaxComponentDto)
  components?: CreateTaxComponentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxSettingsDto {
  @ApiProperty({ description: 'Whether menu prices already include tax' })
  @IsBoolean()
  taxInclusive: boolean;
}

export class CreateChargeConfigDto {
  @ApiProperty({ example: 'Service Charge' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FLAT'] })
  @IsEnum(['PERCENTAGE', 'FLAT'])
  type: 'PERCENTAGE' | 'FLAT';

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Apply only to DINE_IN orders' })
  @IsOptional()
  @IsBoolean()
  dineInOnly?: boolean;
}

export class UpdateChargeConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['PERCENTAGE', 'FLAT'])
  type?: 'PERCENTAGE' | 'FLAT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dineInOnly?: boolean;
}
