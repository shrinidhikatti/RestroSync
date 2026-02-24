import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

class UpsertReceiptSettingsDto {
  @IsOptional() @IsString() headerLine1?: string;
  @IsOptional() @IsString() headerLine2?: string;
  @IsOptional() @IsString() headerLine3?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() fssaiNumber?: string;
  @IsOptional() @IsString() footerLine1?: string;
  @IsOptional() @IsString() footerLine2?: string;
  @IsOptional() @IsString() footerLine3?: string;
  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsString() paperWidth?: string;
  @IsOptional() @IsBoolean() showGstBreakdown?: boolean;
  @IsOptional() @IsBoolean() showItemTax?: boolean;
  @IsOptional() @IsBoolean() showFssai?: boolean;
  @IsOptional() @IsBoolean() showOrderNumber?: boolean;
  @IsOptional() @IsBoolean() showTableNumber?: boolean;
  @IsOptional() @IsBoolean() showCustomerName?: boolean;
  @IsOptional() @IsBoolean() showDateTime?: boolean;
  @IsOptional() @IsBoolean() showUpiQr?: boolean;
  @IsOptional() @IsBoolean() kotShowItemPrice?: boolean;
}

@ApiTags('Receipt Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('receipt-settings')
export class ReceiptSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: JwtPayload) {
    const settings = await this.prisma.receiptSettings.findUnique({
      where: { branchId: user.branchId! },
    });
    return settings ?? { branchId: user.branchId! };
  }

  @Put()
  async upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertReceiptSettingsDto) {
    return this.prisma.receiptSettings.upsert({
      where: { branchId: user.branchId! },
      create: { branchId: user.branchId!, ...dto },
      update: dto,
    });
  }
}
