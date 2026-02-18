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
import { DiscountService } from './discount.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
  UpdateDiscountConfigDto,
  UpdateFraudAlertConfigDto,
} from './dto/discount.dto';

@ApiTags('Discounts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  // ─── Discount CRUD ────────────────────────────────────────────

  @Get('discounts')
  @ApiOperation({ summary: 'List all discounts' })
  getAll(@CurrentUser() user: JwtPayload) {
    return this.discountService.getAll(user.restaurantId!);
  }

  @Get('discounts/:id')
  @ApiOperation({ summary: 'Get discount by ID' })
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.discountService.getOne(user.restaurantId!, id);
  }

  @Post('discounts')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create discount' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDiscountDto) {
    return this.discountService.create(user.restaurantId!, dto, user.userId!);
  }

  @Patch('discounts/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update discount' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountService.update(user.restaurantId!, id, dto);
  }

  @Delete('discounts/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete discount' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.discountService.delete(user.restaurantId!, id);
  }

  // ─── Validate Discount ─────────────────────────────────────────

  @Post('discounts/validate')
  @ApiOperation({ summary: 'Validate discount code and calculate discount amount' })
  validate(@CurrentUser() user: JwtPayload, @Body() dto: ValidateDiscountDto) {
    return this.discountService.validate(user.restaurantId!, dto);
  }

  // ─── Discount Config ──────────────────────────────────────────

  @Get('discount-config')
  @ApiOperation({ summary: 'Get discount configuration' })
  getConfig(@CurrentUser() user: JwtPayload) {
    return this.discountService.getConfig(user.restaurantId!);
  }

  @Patch('discount-config')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update discount configuration' })
  updateConfig(@CurrentUser() user: JwtPayload, @Body() dto: UpdateDiscountConfigDto) {
    return this.discountService.updateConfig(user.restaurantId!, dto);
  }

  // ─── Fraud Alert Config ───────────────────────────────────────

  @Get('fraud-alert-config')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get fraud alert configuration' })
  getFraudConfig(@CurrentUser() user: JwtPayload) {
    return this.discountService.getFraudConfig(user.restaurantId!);
  }

  @Patch('fraud-alert-config')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update fraud alert configuration' })
  updateFraudConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateFraudAlertConfigDto,
  ) {
    return this.discountService.updateFraudConfig(user.restaurantId!, dto);
  }
}
