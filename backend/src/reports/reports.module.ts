import { Module }         from '@nestjs/common';
import { PrismaModule }   from '../prisma/prisma.module';
import { ReportsService }    from './reports.service';
import { AuditService }      from './audit.service';
import { ReportsController } from './reports.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [ReportsController],
  providers:   [ReportsService, AuditService],
  exports:     [AuditService],   // exported so other modules can log audit entries
})
export class ReportsModule {}
