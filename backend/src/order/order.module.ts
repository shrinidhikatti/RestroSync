import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { OrderService } from './order.service';
import { KotService } from './kot.service';
import { BillService } from './bill.service';
import { PaymentService } from './payment.service';
import { OrderController } from './order.controller';

@Module({
  imports: [PrismaModule, GatewayModule],
  providers: [OrderService, KotService, BillService, PaymentService],
  exports: [OrderService, KotService, BillService, PaymentService],
  controllers: [OrderController],
})
export class OrderModule {}
