import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { StockModule } from './stock/stock.module';
import { AuthModule } from './auth/auth.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { LedgerModule } from './ledger/ledger.module';
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
    // Rate-limit config (in-memory). ThrottlerGuard is applied per-controller
    // (auth) rather than globally, so only credential/OTP routes are limited.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    StockModule,
    AuthModule,
    WarehousesModule,
    InventoryModule,
    LedgerModule,
    ProductsModule,
    CategoriesModule,
    OperationsModule,
  ],
  controllers: [HealthController, MetaController],
})
export class AppModule {}
