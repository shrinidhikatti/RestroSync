import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReceiptSettingsController } from './receipt-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReceiptSettingsController],
})
export class ReceiptSettingsModule {}
