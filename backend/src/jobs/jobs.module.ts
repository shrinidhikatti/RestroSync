import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { ArchivalService } from './archival.service';

@Module({
  imports:   [ScheduleModule.forRoot(), PrismaModule],
  providers: [ArchivalService],
})
export class JobsModule {}
