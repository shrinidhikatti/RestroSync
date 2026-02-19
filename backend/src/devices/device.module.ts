import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanLimitsModule } from '../common/plan-limits.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports:     [PrismaModule, PlanLimitsModule],
  controllers: [DeviceController],
  providers:   [DeviceService],
  exports:     [DeviceService],
})
export class DeviceModule {}
