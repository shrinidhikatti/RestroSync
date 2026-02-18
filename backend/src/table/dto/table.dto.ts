import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus, TableStatus } from '@prisma/client';

// ─── Table DTOs ──────────────────────────────────────────────────

export class CreateTableDto {
  @ApiProperty({ example: 'T1' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Ground Floor' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'Main Hall' })
  @IsOptional()
  @IsString()
  section?: string;
}

export class UpdateTableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TableStatus })
  @IsEnum(TableStatus)
  status: TableStatus;
}

// ─── Reservation DTOs ────────────────────────────────────────────

export class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  tableId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  partySize: number;

  @ApiProperty({ example: '2024-12-25', description: 'ISO date string (YYYY-MM-DD)' })
  @IsDateString()
  reservationDate: string;

  @ApiProperty({ example: '19:30' })
  @IsString()
  reservationTime: string;

  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reservationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservationTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
