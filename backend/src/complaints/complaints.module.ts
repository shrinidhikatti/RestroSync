import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController, ComplaintsAnalyticsController } from './complaints.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [ComplaintsController, ComplaintsAnalyticsController],
  providers:   [ComplaintsService],
  exports:     [ComplaintsService],
})
export class ComplaintsModule {}
