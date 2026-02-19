import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateDayCloseDto {}

export class CarryForwardDto {}

export class CompleteDayCloseDto {
  @ApiProperty({ description: 'Actual cash counted in the drawer', example: 5000 })
  @IsNumber()
  @Min(0)
  cashInDrawer: number;

  @ApiPropertyOptional({ description: 'Optional notes about the day-end close', example: 'Minor variance due to coin rounding' })
  @IsOptional()
  @IsString()
  notes?: string;
}
