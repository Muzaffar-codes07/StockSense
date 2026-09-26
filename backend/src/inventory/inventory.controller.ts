import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockQueryDto } from './dto/stock-query.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('stock')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() q: StockQueryDto) {
    return this.inventory.list(q);
  }

  @Get('alerts')
  alerts() {
    return this.inventory.alerts();
  }

  @Get('kpis')
  kpis() {
    return this.inventory.kpis();
  }

  @Get('locations')
  allLocations() {
    return this.inventory.allLocations();
  }

  @Get(':productId/breakdown')
  breakdown(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.inventory.breakdown(productId);
  }

  @Get(':productId/locations')
  locations(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.inventory.locations(productId);
  }
}
