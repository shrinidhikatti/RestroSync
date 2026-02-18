import { Module }          from '@nestjs/common';
import { PrismaModule }    from '../prisma/prisma.module';
import { IngredientService } from './ingredient.service';
import { StockService }      from './stock.service';
import { SupplierService }   from './supplier.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [IngredientService, StockService, SupplierService],
  exports: [IngredientService, StockService],
})
export class InventoryModule {}
