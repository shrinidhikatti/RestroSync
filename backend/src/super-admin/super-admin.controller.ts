import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CreateRestaurantDto, ListRestaurantsQueryDto } from './dto/super-admin.dto';

@ApiTags('Super Admin')
@Controller('super-admin')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
@ApiBearerAuth()
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  @Get('restaurants')
  @ApiOperation({ summary: 'List all restaurants (with search, filter, pagination)' })
  async listRestaurants(@Query() query: ListRestaurantsQueryDto) {
    return this.superAdminService.listRestaurants(query);
  }

  @Get('restaurants/:id')
  @ApiOperation({ summary: 'Get restaurant detail with stats' })
  async getRestaurantDetail(@Param('id') id: string) {
    return this.superAdminService.getRestaurantDetail(id);
  }

  @Post('restaurants')
  @ApiOperation({ summary: 'Create new restaurant + owner account' })
  async createRestaurant(@Body() dto: CreateRestaurantDto) {
    return this.superAdminService.createRestaurant(dto);
  }

  @Patch('restaurants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a restaurant (block all logins)' })
  async suspendRestaurant(@Param('id') id: string) {
    return this.superAdminService.suspendRestaurant(id);
  }

  @Patch('restaurants/:id/activate')
  @ApiOperation({ summary: 'Re-activate a suspended restaurant' })
  async activateRestaurant(@Param('id') id: string) {
    return this.superAdminService.activateRestaurant(id);
  }

  @Delete('restaurants/:id')
  @ApiOperation({ summary: 'Soft-delete a restaurant' })
  async deleteRestaurant(@Param('id') id: string) {
    return this.superAdminService.softDeleteRestaurant(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide stats' })
  async getPlatformStats() {
    return this.superAdminService.getPlatformStats();
  }
}
