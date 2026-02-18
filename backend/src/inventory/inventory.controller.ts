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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard }       from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { IngredientService } from './ingredient.service';
import { StockService }      from './stock.service';
import { SupplierService }   from './supplier.service';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  CreateRecipeDto,
  UpdateRecipeDto,
  StockInDto,
  ManualStockOutDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/inventory.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('inventory')
export class InventoryController {
  constructor(
    private ingredientSvc: IngredientService,
    private stockSvc:      StockService,
    private supplierSvc:   SupplierService,
  ) {}

  // ─── Ingredients ───────────────────────────────────────────────────────────

  @Get('ingredients')
  listIngredients(@CurrentUser() user: JwtPayload) {
    return this.ingredientSvc.listIngredients(user.restaurantId!);
  }

  @Get('ingredients/:id')
  getIngredient(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ingredientSvc.getIngredient(id, user.restaurantId!);
  }

  @Post('ingredients')
  createIngredient(
    @Body() dto: CreateIngredientDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ingredientSvc.createIngredient(user.restaurantId!, dto);
  }

  @Patch('ingredients/:id')
  updateIngredient(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ingredientSvc.updateIngredient(id, user.restaurantId!, dto);
  }

  @Delete('ingredients/:id')
  deleteIngredient(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ingredientSvc.deleteIngredient(id, user.restaurantId!);
  }

  // ─── Recipes ────────────────────────────────────────────────────────────────

  @Get('recipes')
  listRecipes(@CurrentUser() user: JwtPayload) {
    return this.ingredientSvc.listRecipes(user.restaurantId!);
  }

  @Get('recipes/:id')
  getRecipe(@Param('id') id: string) {
    return this.ingredientSvc.getRecipe(id);
  }

  @Post('recipes')
  createRecipe(
    @Body() dto: CreateRecipeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ingredientSvc.createRecipe(user.restaurantId!, dto);
  }

  @Patch('recipes/:id')
  updateRecipe(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.ingredientSvc.updateRecipe(id, dto);
  }

  @Delete('recipes/:id')
  deleteRecipe(@Param('id') id: string) {
    return this.ingredientSvc.deleteRecipe(id);
  }

  // ─── Stock levels ────────────────────────────────────────────────────────────

  @Get('stock')
  getStockLevels(@CurrentUser() user: JwtPayload) {
    return this.stockSvc.getStockLevels(user.branchId!);
  }

  @Get('stock/alerts/low-stock')
  getLowStockAlerts(@CurrentUser() user: JwtPayload) {
    return this.ingredientSvc.getLowStockAlerts(user.branchId!);
  }

  @Get('stock/alerts/expiry')
  getExpiryAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('days', new DefaultValuePipe(3), ParseIntPipe) days: number,
  ) {
    return this.ingredientSvc.getExpiryAlerts(user.branchId!, days);
  }

  @Get('stock/batches/:ingredientId')
  getBatches(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stockSvc.getBatches(user.branchId!, ingredientId);
  }

  @Get('stock/transactions')
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('ingredientId') ingredientId?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ) {
    return this.stockSvc.getTransactions(user.branchId!, ingredientId, limit);
  }

  @Post('stock/in')
  stockIn(
    @Body() dto: StockInDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stockSvc.stockIn(user.branchId!, user.userId, dto);
  }

  @Post('stock/out')
  manualStockOut(
    @Body() dto: ManualStockOutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stockSvc.manualStockOut(user.branchId!, user.userId, dto);
  }

  @Post('stock/batches/:batchId/write-off')
  writeOffBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stockSvc.writeOffBatch(batchId, user.branchId!, user.userId);
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  @Get('suppliers')
  listSuppliers(@CurrentUser() user: JwtPayload) {
    return this.supplierSvc.listSuppliers(user.restaurantId!);
  }

  @Get('suppliers/:id')
  getSupplier(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.getSupplier(id, user.restaurantId!);
  }

  @Post('suppliers')
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.createSupplier(user.restaurantId!, dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.updateSupplier(id, user.restaurantId!, dto);
  }

  @Delete('suppliers/:id')
  deleteSupplier(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.deleteSupplier(id, user.restaurantId!);
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────────────

  @Get('purchase-orders')
  listPurchaseOrders(@CurrentUser() user: JwtPayload) {
    return this.supplierSvc.listPurchaseOrders(user.branchId!);
  }

  @Get('purchase-orders/:id')
  getPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.getPurchaseOrder(id, user.branchId!);
  }

  @Post('purchase-orders')
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.createPurchaseOrder(user.branchId!, user.userId, dto);
  }

  @Patch('purchase-orders/:id')
  updatePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.updatePurchaseOrder(id, user.branchId!, dto);
  }

  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.receivePurchaseOrder(id, user.branchId!, user.userId, dto);
  }

  @Post('purchase-orders/:id/cancel')
  cancelPurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supplierSvc.cancelPurchaseOrder(id, user.branchId!);
  }
}
