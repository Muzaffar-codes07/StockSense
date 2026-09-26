import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

// Imports AuthModule so JwtAuthGuard's JwtService dependency resolves.
@Module({
  imports: [AuthModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
