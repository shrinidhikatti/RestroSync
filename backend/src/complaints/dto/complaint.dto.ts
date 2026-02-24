import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ComplaintReason } from '@prisma/client';

export class FileComplaintDto {
  @IsString()
  orderItemId: string;

  @IsEnum(ComplaintReason)
  reason: ComplaintReason;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveComplaintDto {
  @IsString()
  resolution: string;
}
