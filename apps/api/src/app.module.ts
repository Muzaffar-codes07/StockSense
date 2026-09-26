import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StockModule } from './stock/stock.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

// Root module. Feature modules are added here as each role builds them:
//   Role 3 -> ProductsModule, CategoriesModule
//   Role 4 -> ReceiptsModule, DeliveriesModule, TransfersModule, AdjustmentsModule
//   Role 1 -> WarehousesModule
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StockModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
