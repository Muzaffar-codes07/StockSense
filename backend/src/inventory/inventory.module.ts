import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockQuantRepository } from './stock-quant.repository';

// Read-only stock views (Role 3). Everything here derives from the ledger.
@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [StockQuantRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
