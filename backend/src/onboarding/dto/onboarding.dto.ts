import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportTemplateDto {
  @ApiProperty({ example: 'template-uuid' })
  @IsString()
  @IsNotEmpty()
  templateId!: string;
}

export class UpdateOnboardingProgressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  modeSelected?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  menuAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taxConfigured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tablesConfigured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staffAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  printerSetup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDismissed?: boolean;
}
