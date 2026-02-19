import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NumberRangesService } from './number-ranges.service';
import { NumberRangesController } from './number-ranges.controller';

@Module({
  imports: [PrismaModule],
  providers: [NumberRangesService],
  controllers: [NumberRangesController],
  exports: [NumberRangesService],
})
export class NumberRangesModule {}
