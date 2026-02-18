import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { CategoryService } from './category.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [MenuController],
  providers: [MenuService, CategoryService],
  exports: [MenuService, CategoryService],
})
export class MenuModule {}
