import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard }  from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CustomerService }  from './customer.service';
import { LoyaltyService }   from './loyalty.service';
import { CreditService }    from './credit.service';
import { AttendanceService } from './attendance.service';
import {
  CreateCustomerDto, UpdateCustomerDto,
  CreateCreditAccountDto, UpdateCreditAccountDto,
  ChargeCreditDto, SettleCreditDto,
  AdjustLoyaltyDto, RedeemLoyaltyDto,
  UpdateLoyaltyConfigDto,
  ClockInDto,
} from './dto/crm.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('crm')
export class CrmController {
  constructor(
    private customerSvc:   CustomerService,
    private loyaltySvc:    LoyaltyService,
    private creditSvc:     CreditService,
    private attendanceSvc: AttendanceService,
  ) {}

  // ─── Customers ────────────────────────────────────────────────────────────

  @Post('customers')
  createCustomer(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customerSvc.create(user.restaurantId!, dto);
  }

  @Get('customers')
  listCustomers(
    @CurrentUser() user: JwtPayload,
    @Query('search')   search?: string,
    @Query('tag')      tag?:    string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?:  number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ) {
    return this.customerSvc.findAll(user.restaurantId!, { search, tag, page, limit });
  }

  @Get('customers/segments')
  getSegments(@CurrentUser() user: JwtPayload) {
    return this.customerSvc.getSegments(user.restaurantId!);
  }

  @Get('customers/:id')
  getCustomer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customerSvc.findOne(user.restaurantId!, id);
  }

  @Patch('customers/:id')
  updateCustomer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerSvc.update(user.restaurantId!, id, dto);
  }

  @Delete('customers/:id/data')
  anonymizeCustomer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customerSvc.anonymize(user.restaurantId!, id);
  }

  // ─── Loyalty ──────────────────────────────────────────────────────────────

  @Get('loyalty/config')
  getLoyaltyConfig(@CurrentUser() user: JwtPayload) {
    return this.loyaltySvc.getConfig(user.restaurantId!);
  }

  @Patch('loyalty/config')
  updateLoyaltyConfig(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLoyaltyConfigDto) {
    return this.loyaltySvc.updateConfig(user.restaurantId!, dto);
  }

  @Get('loyalty/events')
  getUpcomingEvents(
    @CurrentUser() user: JwtPayload,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.loyaltySvc.getUpcomingEvents(user.restaurantId!, days);
  }

  @Get('customers/:customerId/loyalty')
  getLoyaltyBalance(@Param('customerId') customerId: string) {
    return this.loyaltySvc.getBalance(customerId).then((points) => ({ points }));
  }

  @Get('customers/:customerId/loyalty/history')
  getLoyaltyHistory(@Param('customerId') customerId: string) {
    return this.loyaltySvc.getHistory(customerId);
  }

  @Post('customers/:customerId/loyalty/adjust')
  adjustLoyalty(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Body() dto: AdjustLoyaltyDto,
  ) {
    return this.loyaltySvc.adjust(user.restaurantId!, customerId, dto);
  }

  @Post('customers/:customerId/loyalty/redeem')
  redeemLoyalty(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Body() dto: RedeemLoyaltyDto,
  ) {
    return this.loyaltySvc.redeem(user.restaurantId!, customerId, dto);
  }

  // ─── Credit Accounts ──────────────────────────────────────────────────────

  @Post('credit-accounts')
  createCreditAccount(@CurrentUser() user: JwtPayload, @Body() dto: CreateCreditAccountDto) {
    return this.creditSvc.createAccount(user.restaurantId!, dto, user.userId);
  }

  @Get('credit-accounts')
  listCreditAccounts(@CurrentUser() user: JwtPayload) {
    return this.creditSvc.listAccounts(user.restaurantId!);
  }

  @Get('credit-accounts/aging')
  getCreditAging(@CurrentUser() user: JwtPayload) {
    return this.creditSvc.agingReport(user.restaurantId!);
  }

  @Get('credit-accounts/customer/:customerId')
  getCreditAccount(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
  ) {
    return this.creditSvc.getAccount(user.restaurantId!, customerId);
  }

  @Patch('credit-accounts/:id')
  updateCreditAccount(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCreditAccountDto,
  ) {
    return this.creditSvc.updateAccount(user.restaurantId!, id, dto);
  }

  @Post('credit-accounts/:id/charge')
  chargeCredit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ChargeCreditDto,
  ) {
    return this.creditSvc.charge(user.restaurantId!, id, dto, user.userId);
  }

  @Post('credit-accounts/:id/settle')
  settleCredit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SettleCreditDto,
  ) {
    return this.creditSvc.settle(user.restaurantId!, id, dto, user.userId);
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  @Post('attendance/clock-in')
  clockIn(@CurrentUser() user: JwtPayload, @Body() dto: ClockInDto) {
    return this.attendanceSvc.clockIn(dto.branchId ?? user.branchId!, dto.userId);
  }

  @Post('attendance/clock-out/:attendanceId')
  clockOut(
    @CurrentUser() user: JwtPayload,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.attendanceSvc.clockOut(user.branchId!, attendanceId);
  }

  @Get('attendance')
  getAttendance(
    @CurrentUser() user: JwtPayload,
    @Query('userId')  userId?: string,
    @Query('from')    from?:   string,
    @Query('to')      to?:     string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?:  number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.attendanceSvc.getRecords(user.branchId!, { userId, from, to, page, limit });
  }

  @Get('attendance/on-duty')
  getOnDuty(@CurrentUser() user: JwtPayload) {
    return this.attendanceSvc.getOnDuty(user.branchId!);
  }

  @Get('attendance/summary')
  getAttendanceSummary(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.attendanceSvc.getSummary(user.branchId!, from ?? today, to ?? today);
  }
}
