import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { BranchModule } from './branch/branch.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';
import { TaxModule } from './tax/tax.module';
import { MenuModule } from './menu/menu.module';
import { TableModule } from './table/table.module';
import { DiscountModule } from './discount/discount.module';
import { OrderModule } from './order/order.module';
import { KdsModule } from './kds/kds.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { CrmModule }          from './crm/crm.module';
import { MultiOutletModule }  from './multi-outlet/multi-outlet.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { DeviceModule }       from './devices/device.module';
import { JobsModule }         from './jobs/jobs.module';
import { DayCloseModule }     from './day-close/day-close.module';
import { NumberRangesModule } from './number-ranges/number-ranges.module';
import { DemoModule }         from './demo/demo.module';
import { ComplaintsModule }   from './complaints/complaints.module';
import { ReceiptSettingsModule } from './receipt-settings/receipt-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: process.env.NODE_ENV === 'development' ? 10000 : 100 },
      { name: 'login', ttl: 900000, limit: process.env.NODE_ENV === 'development' ? 1000 : 50 },
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    RestaurantModule,
    BranchModule,
    SuperAdminModule,
    OnboardingModule,
    HealthModule,
    GatewayModule,
    TaxModule,
    MenuModule,
    TableModule,
    DiscountModule,
    OrderModule,
    KdsModule,
    InventoryModule,
    ReportsModule,
    CrmModule,
    MultiOutletModule,
    IntegrationsModule,
    DeviceModule,
    JobsModule,
    DayCloseModule,
    NumberRangesModule,
    DemoModule,
    ComplaintsModule,
    ReceiptSettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
