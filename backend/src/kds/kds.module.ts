import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KdsService } from './kds.service';
import { KdsController } from './kds.controller';

@Module({
  imports: [PrismaModule],
  providers: [KdsService],
  controllers: [KdsController],
})
export class KdsModule {}
