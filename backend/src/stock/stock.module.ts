import { Module } from '@nestjs/common';
import { StockService } from './stock.service';

// Exported so Role 3 (stock views/KPIs) and Role 4 (operation validate)
// can inject StockService.
@Module({
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
