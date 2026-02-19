import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DayCloseService } from './day-close.service';
import { CompleteDayCloseDto } from './day-close.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Day Close')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class DayCloseController {
  constructor(private readonly dayCloseService: DayCloseService) {}

  /** Get current day-close status for the branch */
  @Get('day-close/status')
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.dayCloseService.getStatus(user.branchId!);
  }

  /** List all unbilled/open orders for today's business date */
  @Get('day-close/unbilled')
  getUnbilled(@CurrentUser() user: JwtPayload) {
    return this.dayCloseService.getUnbilledOrders(user.branchId!);
  }

  /** Initiate day-end close — fails if unbilled orders exist */
  @Post('day-close/initiate')
  initiate(@CurrentUser() user: JwtPayload) {
    return this.dayCloseService.initiate(user.branchId!, user.userId);
  }

  /** Carry forward all open orders to the next business date */
  @Post('day-close/carry-forward')
  carryForward(@CurrentUser() user: JwtPayload) {
    return this.dayCloseService.carryForward(user.branchId!, user.userId);
  }

  /**
   * Submit cash reconciliation and complete the day close.
   * Must call initiate first.
   */
  @Post('day-close/complete')
  complete(@CurrentUser() user: JwtPayload, @Body() dto: CompleteDayCloseDto) {
    return this.dayCloseService.complete(user.branchId!, user.userId, dto);
  }
}
