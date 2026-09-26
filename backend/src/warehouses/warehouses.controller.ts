import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WarehousesService } from './warehouses.service';
import {
  CreateLocationDto,
  CreateWarehouseDto,
  LocationQueryDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';

// GET /warehouses          -> warehouses (with nested locations) for filters
// GET /locations?warehouseId= -> flat location list for pickers
@UseGuards(JwtAuthGuard)
@Controller()
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get('warehouses')
  listWarehouses() {
    return this.warehouses.listWarehouses();
  }

  @Post('warehouses')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.createWarehouse(dto);
  }

  @Patch('warehouses/:id')
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.updateWarehouse(id, dto);
  }

  @Get('locations')
  listLocations(@Query() query: LocationQueryDto) {
    return this.warehouses.listLocations(query.warehouseId);
  }

  @Post('locations')
  createLocation(@Body() dto: CreateLocationDto) {
    return this.warehouses.createLocation(dto);
  }
}
