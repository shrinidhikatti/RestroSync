import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsController } from './integrations.controller';
import { PaymentGatewayService }  from './payment-gateway.service';
import { AggregatorService }      from './aggregator.service';
import { NotificationService }    from './notification.service';
import { AccountingService }      from './accounting.service';
import { AdvancedPosService }     from './advanced-pos.service';

@Module({
  imports:     [PrismaModule],
  controllers: [IntegrationsController],
  providers: [
    PaymentGatewayService,
    AggregatorService,
    NotificationService,
    AccountingService,
    AdvancedPosService,
  ],
  exports: [PaymentGatewayService, NotificationService, AccountingService],
})
export class IntegrationsModule {}
