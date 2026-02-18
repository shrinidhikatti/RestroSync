import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CategoryService } from './category.service';
import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  ToggleAvailabilityDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateAddonDto,
  UpdateAddonDto,
  CreatePriceOverrideDto,
  CreateComboItemDto,
  UpdateComboItemDto,
  ImportMenuCsvDto,
} from './dto/menu.dto';

@ApiTags('Menu')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class MenuController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly menuService: MenuService,
  ) {}

  // ─── Categories ───────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  getCategories(@CurrentUser() user: JwtPayload) {
    return this.categoryService.getAll(user.restaurantId!);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category with its items' })
  getCategory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.categoryService.getOne(user.restaurantId!, id);
  }

  @Post('categories')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create category' })
  createCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoryDto) {
    return this.categoryService.create(user.restaurantId!, dto);
  }

  @Patch('categories/reorder')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Reorder categories' })
  reorderCategories(@CurrentUser() user: JwtPayload, @Body() dto: ReorderCategoriesDto) {
    return this.categoryService.reorder(user.restaurantId!, dto);
  }

  @Patch('categories/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update category' })
  updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(user.restaurantId!, id, dto);
  }

  @Delete('categories/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete or deactivate category' })
  deleteCategory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.categoryService.remove(user.restaurantId!, id);
  }

  // ─── Menu Items ───────────────────────────────────────────────

  @Get('menu-items')
  @ApiOperation({ summary: 'List all menu items' })
  @ApiQuery({ name: 'categoryId', required: false })
  getMenuItems(
    @CurrentUser() user: JwtPayload,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.menuService.getAll(user.restaurantId!, categoryId);
  }

  @Get('menu-items/:id')
  @ApiOperation({ summary: 'Get single menu item' })
  getMenuItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.getOne(user.restaurantId!, id);
  }

  @Post('menu-items')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create menu item' })
  createMenuItem(@CurrentUser() user: JwtPayload, @Body() dto: CreateMenuItemDto) {
    return this.menuService.create(user.restaurantId!, dto);
  }

  @Patch('menu-items/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update menu item' })
  updateMenuItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.update(user.restaurantId!, id, dto);
  }

  @Patch('menu-items/:id/availability')
  @Roles('OWNER', 'MANAGER', 'BILLER')
  @ApiOperation({ summary: 'Toggle item availability (86 an item)' })
  toggleAvailability(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    return this.menuService.toggleAvailability(
      user.restaurantId!,
      id,
      dto,
      user.branchId!,
    );
  }

  @Delete('menu-items/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Archive menu item (soft delete)' })
  archiveMenuItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.archive(user.restaurantId!, id);
  }

  // ─── Variants ─────────────────────────────────────────────────

  @Post('menu-items/:id/variants')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Add variant to menu item' })
  createVariant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.menuService.createVariant(user.restaurantId!, id, dto);
  }

  @Patch('menu-items/:id/variants/:variantId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update variant' })
  updateVariant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.menuService.updateVariant(user.restaurantId!, id, variantId, dto);
  }

  @Delete('menu-items/:id/variants/:variantId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete variant' })
  deleteVariant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return this.menuService.deleteVariant(user.restaurantId!, id, variantId);
  }

  // ─── Addons ───────────────────────────────────────────────────

  @Post('menu-items/:id/addons')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Add addon to menu item' })
  createAddon(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateAddonDto,
  ) {
    return this.menuService.createAddon(user.restaurantId!, id, dto);
  }

  @Patch('menu-items/:id/addons/:addonId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update addon' })
  updateAddon(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateAddonDto,
  ) {
    return this.menuService.updateAddon(user.restaurantId!, id, addonId, dto);
  }

  @Delete('menu-items/:id/addons/:addonId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete addon' })
  deleteAddon(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.menuService.deleteAddon(user.restaurantId!, id, addonId);
  }

  // ─── Price Overrides ──────────────────────────────────────────

  @Post('menu-items/:id/price-overrides')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create or update price override for order type' })
  upsertPriceOverride(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreatePriceOverrideDto,
  ) {
    return this.menuService.upsertPriceOverride(user.restaurantId!, id, dto);
  }

  @Delete('menu-items/:id/price-overrides/:overrideId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete price override' })
  deletePriceOverride(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('overrideId') overrideId: string,
  ) {
    return this.menuService.deletePriceOverride(user.restaurantId!, id, overrideId);
  }

  // ─── Combos ───────────────────────────────────────────────────

  @Get('combo-items')
  @ApiOperation({ summary: 'List all combo items' })
  getCombos(@CurrentUser() user: JwtPayload) {
    return this.menuService.getCombos(user.restaurantId!);
  }

  @Post('combo-items')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create combo item' })
  createCombo(@CurrentUser() user: JwtPayload, @Body() dto: CreateComboItemDto) {
    return this.menuService.createCombo(user.restaurantId!, dto);
  }

  @Patch('combo-items/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update combo item' })
  updateCombo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateComboItemDto,
  ) {
    return this.menuService.updateCombo(user.restaurantId!, id, dto);
  }

  @Delete('combo-items/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Delete combo item' })
  deleteCombo(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.menuService.deleteCombo(user.restaurantId!, id);
  }

  // ─── CSV Import ───────────────────────────────────────────────

  @Post('menu-items/import-csv')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Bulk import menu items from parsed CSV rows' })
  importCsv(@CurrentUser() user: JwtPayload, @Body() dto: ImportMenuCsvDto) {
    return this.menuService.importCsv(user.restaurantId!, dto);
  }
}
