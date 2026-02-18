import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { TaxService } from './tax.service';
import {
  CreateTaxGroupDto,
  UpdateTaxGroupDto,
  UpdateTaxSettingsDto,
  CreateChargeConfigDto,
  UpdateChargeConfigDto,
} from './dto/tax.dto';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // ─── Tax Groups ───────────────────────────────────────────────

  @Get('tax-groups')
  @ApiOperation({ summary: 'List all tax groups' })
  getTaxGroups(@CurrentUser() user: JwtPayload) {
    return this.taxService.getTaxGroups(user.restaurantId!);
  }

  @Get('tax-groups/:id')
  @ApiOperation({ summary: 'Get tax group by ID' })
  getTaxGroup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.taxService.getTaxGroup(user.restaurantId!, id);
  }

  @Post('tax-groups')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create tax group' })
  createTaxGroup(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaxGroupDto) {
    return this.taxService.createTaxGroup(user.restaurantId!, dto);
  }

  @Patch('tax-groups/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update tax group' })
  updateTaxGroup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaxGroupDto,
  ) {
    return this.taxService.updateTaxGroup(user.restaurantId!, id, dto);
  }

  @Delete('tax-groups/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete tax group (fails if items use it)' })
  deleteTaxGroup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.taxService.deleteTaxGroup(user.restaurantId!, id);
  }

  // ─── Tax Settings ─────────────────────────────────────────────

  @Patch('tax/settings')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update tax-inclusive setting for restaurant' })
  updateTaxSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTaxSettingsDto,
  ) {
    return this.taxService.updateTaxSettings(user.restaurantId!, dto);
  }

  // ─── Charge Configs ───────────────────────────────────────────

  @Get('charges')
  @ApiOperation({ summary: 'List all charge configs (service charge, packing, etc.)' })
  getChargeConfigs(@CurrentUser() user: JwtPayload) {
    return this.taxService.getChargeConfigs(user.restaurantId!);
  }

  @Post('charges')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create charge config' })
  createChargeConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateChargeConfigDto,
  ) {
    return this.taxService.createChargeConfig(user.restaurantId!, dto);
  }

  @Patch('charges/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update charge config' })
  updateChargeConfig(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChargeConfigDto,
  ) {
    return this.taxService.updateChargeConfig(user.restaurantId!, id, dto);
  }

  @Delete('charges/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete charge config' })
  deleteChargeConfig(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.taxService.deleteChargeConfig(user.restaurantId!, id);
  }
}
