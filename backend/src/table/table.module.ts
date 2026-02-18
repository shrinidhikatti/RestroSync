import { Module } from '@nestjs/common';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { ReservationService } from './reservation.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [TableController],
  providers: [TableService, ReservationService],
  exports: [TableService, ReservationService],
})
export class TableModule {}
