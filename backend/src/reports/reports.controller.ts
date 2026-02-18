import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard }  from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { AuditService }   from './audit.service';

@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(
    private reportsSvc: ReportsService,
    private auditSvc:   AuditService,
  ) {}

  // ─── Summary ─────────────────────────────────────────────────────────────────

  @Get('summary')
  dailySummary(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.reportsSvc.dailySummary(user.branchId!, from ?? today, to ?? today);
  }

  @Get('daily-trend')
  dailyTrend(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.dailyTrend(user.branchId!, from ?? week, to ?? today);
  }

  @Get('hourly')
  hourlySales(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.reportsSvc.hourlySales(user.branchId!, from ?? today, to ?? today);
  }

  @Get('items')
  itemSales(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.itemSales(user.branchId!, from ?? week, to ?? today, limit);
  }

  @Get('payments')
  paymentBreakdown(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.paymentBreakdown(user.branchId!, from ?? week, to ?? today);
  }

  @Get('tax')
  taxReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.taxReport(user.branchId!, from ?? week, to ?? today);
  }

  // ─── Fraud / void / discount ──────────────────────────────────────────────────

  @Get('voids')
  voidReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.voidReport(user.branchId!, from ?? week, to ?? today);
  }

  @Get('discounts')
  discountReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportsSvc.discountReport(user.branchId!, from ?? week, to ?? today);
  }

  // ─── Pre-compute daily report ─────────────────────────────────────────────────

  @Post('compute/:date')
  computeDaily(
    @Param('date') date: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsSvc.computeDailyReport(user.branchId!, date);
  }

  // ─── Audit logs ───────────────────────────────────────────────────────────────

  @Get('audit')
  getAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query('userId')   userId?:   string,
    @Query('action')   action?:   string,
    @Query('entity')   entity?:   string,
    @Query('entityId') entityId?: string,
    @Query('from')     from?:     string,
    @Query('to')       to?:       string,
    @Query('search')   search?:   string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)   page?:  number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.auditSvc.getLogs({
      restaurantId: user.restaurantId!,
      branchId:     user.branchId ?? undefined,
      userId, action, entity, entityId, from, to, search, page, limit,
    });
  }

  @Get('audit/actors')
  getAuditActors(@CurrentUser() user: JwtPayload) {
    return this.auditSvc.getLogActors(user.restaurantId!);
  }

  @Get('audit/actions')
  getAuditActions(@CurrentUser() user: JwtPayload) {
    return this.auditSvc.getActionCategories(user.restaurantId!);
  }
}
