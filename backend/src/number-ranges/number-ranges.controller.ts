import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NumberRangesService } from './number-ranges.service';
import { AllocateRangeDto, AcknowledgeRangeDto } from './number-ranges.dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Number Ranges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class NumberRangesController {
  constructor(private readonly numberRangesService: NumberRangesService) {}

  /** List all number ranges allocated for this branch's current financial year */
  @Get('number-ranges')
  list(@CurrentUser() user: JwtPayload) {
    return this.numberRangesService.listRanges(user.branchId!);
  }

  /**
   * Device calls this to pre-allocate a block of offline bill/KOT numbers.
   * The device then uses these numbers without connectivity.
   */
  @Post('number-ranges/allocate')
  allocate(@CurrentUser() user: JwtPayload, @Body() dto: AllocateRangeDto) {
    return this.numberRangesService.allocate(
      user.branchId!,
      dto.deviceId,
      dto.type,
      dto.blockSize ?? 50,
    );
  }

  /**
   * Device calls this when syncing back online to report how many
   * numbers it actually used.
   */
  @Patch('number-ranges/:id/acknowledge')
  acknowledge(@Param('id') id: string, @Body() dto: AcknowledgeRangeDto) {
    return this.numberRangesService.acknowledge(id, dto.usedUpTo);
  }
}
