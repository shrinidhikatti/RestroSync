import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KdsService } from './kds.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('KDS')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('kds')
export class KdsController {
  constructor(private readonly kdsService: KdsService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get all active KOTs for the kitchen display' })
  getActiveKots(
    @CurrentUser() user: JwtPayload,
    @Query('station') station?: string,
  ) {
    return this.kdsService.getActiveKots(user.branchId!, station);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get KDS order counts by status' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.kdsService.getKdsSummary(user.branchId!);
  }
}
