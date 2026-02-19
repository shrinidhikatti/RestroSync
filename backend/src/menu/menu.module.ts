import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { CategoryService } from './category.service';
import { GatewayModule } from '../gateway/gateway.module';
import { PlanLimitsModule } from '../common/plan-limits.module';

@Module({
  imports: [GatewayModule, PlanLimitsModule],
  controllers: [MenuController],
  providers: [MenuService, CategoryService],
  exports: [MenuService, CategoryService],
})
export class MenuModule {}
