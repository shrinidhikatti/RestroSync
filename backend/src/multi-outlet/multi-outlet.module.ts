import { Module } from '@nestjs/common';
import { PrismaModule }             from '../prisma/prisma.module';
import { MenuPushService }           from './menu-push.service';
import { ConsolidatedReportService } from './consolidated-report.service';
import { StockTransferService }      from './stock-transfer.service';
import { MultiOutletController }     from './multi-outlet.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [MultiOutletController],
  providers:   [MenuPushService, ConsolidatedReportService, StockTransferService],
  exports:     [MenuPushService, ConsolidatedReportService],
})
export class MultiOutletModule {}
