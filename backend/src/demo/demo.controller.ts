import { Controller, Post, Delete, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Demo')
@Controller('demo')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class DemoController {
  constructor(private demoService: DemoService) {}

  @Post('seed')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Seed 30 menu items, 8 tables, 5 orders for demo' })
  async seed(@CurrentUser() user: JwtPayload) {
    return this.demoService.seed(user.restaurantId!, user.branchId!);
  }

  @Delete('wipe')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Remove all demo data' })
  async wipe(@CurrentUser() user: JwtPayload) {
    return this.demoService.wipe(user.restaurantId!);
  }
}
