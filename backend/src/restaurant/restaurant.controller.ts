import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateRestaurantDto, SetOperatingModeDto, CreateStaffDto } from './dto/restaurant.dto';

@ApiTags('Restaurant')
@Controller('restaurants')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class RestaurantController {
  constructor(private restaurantService: RestaurantService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current restaurant profile' })
  async getMyRestaurant(@CurrentUser() user: JwtPayload) {
    return this.restaurantService.getMyRestaurant(user.restaurantId!);
  }

  @Patch('me')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update restaurant profile' })
  async updateRestaurant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantService.updateRestaurant(user.restaurantId!, dto);
  }

  @Patch('me/operating-mode')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Set restaurant operating mode' })
  async setOperatingMode(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetOperatingModeDto,
  ) {
    return this.restaurantService.setOperatingMode(user.restaurantId!, dto);
  }

  // ─── Staff management ─────────────────────────────────────────────────────

  @Get('me/staff')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'List all staff members' })
  async listStaff(@CurrentUser() user: JwtPayload) {
    return this.restaurantService.listStaff(user.restaurantId!);
  }

  @Post('me/staff')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a staff member (plan limit enforced)' })
  async createStaff(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStaffDto,
  ) {
    return this.restaurantService.createStaff(user.restaurantId!, dto);
  }

  @Delete('me/staff/:userId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate a staff member' })
  async deactivateStaff(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    return this.restaurantService.deactivateStaff(user.restaurantId!, userId);
  }
}
