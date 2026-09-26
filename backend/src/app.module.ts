import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StockModule } from './stock/stock.module';
import { AuthModule } from './auth/auth.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthController } from './health/health.controller';
import { MetaController } from './meta/meta.controller';

import { OperationsModule } from './operations/operations.module';

// Root module. Feature modules are added here as each role builds them:
//   Role 3 -> ProductsModule, CategoriesModule
//   Role 4 -> OperationsModule
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StockModule,
    AuthModule,
    WarehousesModule,
    InventoryModule,
    ProductsModule,
    CategoriesModule,
    OperationsModule,
  ],
  controllers: [HealthController, MetaController],
})
export class AppModule {}
