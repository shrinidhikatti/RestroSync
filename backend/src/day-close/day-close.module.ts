import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DayCloseService } from './day-close.service';
import { DayCloseController } from './day-close.controller';

@Module({
  imports: [PrismaModule],
  providers: [DayCloseService],
  controllers: [DayCloseController],
  exports: [DayCloseService],
})
export class DayCloseModule {}
