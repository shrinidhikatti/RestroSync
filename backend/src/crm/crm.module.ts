import { Module } from '@nestjs/common';
import { PrismaModule }     from '../prisma/prisma.module';
import { CustomerService }  from './customer.service';
import { LoyaltyService }   from './loyalty.service';
import { CreditService }    from './credit.service';
import { AttendanceService } from './attendance.service';
import { CrmController }    from './crm.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [CrmController],
  providers:   [CustomerService, LoyaltyService, CreditService, AttendanceService],
  exports:     [CustomerService, LoyaltyService, CreditService],
})
export class CrmModule {}
