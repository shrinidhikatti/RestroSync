import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard }  from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { MenuPushService }            from './menu-push.service';
import { ConsolidatedReportService }  from './consolidated-report.service';
import { StockTransferService }       from './stock-transfer.service';
import {
  PushMenuToBranchDto,
  UpsertBranchOverrideDto,
  BulkBranchOverrideDto,
  CreateStockTransferDto,
  UpdateTransferStatusDto,
} from './dto/multi-outlet.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('multi-outlet')
export class MultiOutletController {
  constructor(
    private menuPushSvc:    MenuPushService,
    private reportSvc:      ConsolidatedReportService,
    private transferSvc:    StockTransferService,
  ) {}

  // ─── Consolidated Reports ─────────────────────────────────────────────────

  @Get('overview')
  overview(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportSvc.consolidatedOverview(user.restaurantId!, from ?? week, to ?? today);
  }

  @Get('comparison')
  branchComparison(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportSvc.branchComparison(user.restaurantId!, from ?? week, to ?? today);
  }

  @Get('top-items')
  topItems(
    @CurrentUser() user: JwtPayload,
    @Query('from')  from?:  string,
    @Query('to')    to?:    string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportSvc.topItemsConsolidated(user.restaurantId!, from ?? week, to ?? today, limit);
  }

  @Get('payments')
  consolidatedPayments(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    return this.reportSvc.consolidatedPayments(user.restaurantId!, from ?? week, to ?? today);
  }

  // ─── Menu Push ────────────────────────────────────────────────────────────

  @Post('menu/push')
  pushMenu(@CurrentUser() user: JwtPayload, @Body() dto: PushMenuToBranchDto) {
    return this.menuPushSvc.pushToAllBranches(user.restaurantId!, dto);
  }

  // ─── Branch Menu Overrides ────────────────────────────────────────────────

  @Get('branches/:branchId/menu')
  getBranchMenu(
    @CurrentUser() user: JwtPayload,
    @Param('branchId') branchId: string,
  ) {
    return this.menuPushSvc.getCentralMenuWithOverrides(user.restaurantId!, branchId);
  }

  @Get('branches/:branchId/overrides')
  getBranchOverrides(@Param('branchId') branchId: string) {
    return this.menuPushSvc.getBranchOverrides(branchId);
  }

  @Post('branches/:branchId/overrides')
  upsertOverride(
    @Param('branchId') branchId: string,
    @Body() dto: UpsertBranchOverrideDto,
  ) {
    return this.menuPushSvc.upsertOverride(branchId, dto);
  }

  @Post('branches/:branchId/overrides/bulk')
  bulkUpsertOverrides(
    @Param('branchId') branchId: string,
    @Body() dto: BulkBranchOverrideDto,
  ) {
    return this.menuPushSvc.bulkUpsertOverrides(branchId, dto.overrides);
  }

  @Delete('branches/:branchId/overrides/:menuItemId')
  deleteOverride(
    @Param('branchId')   branchId:   string,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.menuPushSvc.deleteOverride(branchId, menuItemId);
  }

  // ─── Stock Transfers ──────────────────────────────────────────────────────

  @Post('stock-transfers')
  createTransfer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStockTransferDto,
  ) {
    return this.transferSvc.create(user.branchId!, dto, user.userId);
  }

  @Get('stock-transfers')
  listTransfers(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
  ) {
    return this.transferSvc.list(user.restaurantId!, branchId);
  }

  @Patch('stock-transfers/:id/status')
  updateTransferStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransferStatusDto,
  ) {
    return this.transferSvc.updateStatus(id, user.branchId!, dto);
  }
}
