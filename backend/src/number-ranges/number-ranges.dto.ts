import { IsIn, IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AllocateRangeDto {
  @ApiProperty({ enum: ['BILL', 'KOT'], description: 'Type of number range to allocate' })
  @IsIn(['BILL', 'KOT'])
  type: 'BILL' | 'KOT';

  @ApiProperty({ description: 'Device ID requesting the range' })
  @IsString()
  deviceId: string;

  @ApiPropertyOptional({ description: 'Number of slots to pre-allocate (1–200)', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  blockSize?: number;
}

export class AcknowledgeRangeDto {
  @ApiProperty({ description: 'Highest number actually used by the device' })
  @IsNumber()
  @Min(1)
  usedUpTo: number;
}
