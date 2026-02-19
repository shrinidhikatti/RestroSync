import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { RegisterDeviceDto, UpdateDeviceDto } from '../integrations/dto/integrations.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.deviceService.register(user.restaurantId!, user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('branchId') branchId?: string) {
    return this.deviceService.list(user.restaurantId!, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deviceService.findOne(user.restaurantId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.deviceService.update(user.restaurantId!, id, dto);
  }

  @Post(':id/heartbeat')
  heartbeat(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deviceService.heartbeat(user.restaurantId!, id);
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deviceService.revoke(user.restaurantId!, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deviceService.delete(user.restaurantId!, id);
  }
}
