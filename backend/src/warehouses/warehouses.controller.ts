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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { WarehousesService } from './warehouses.service';
import {
  CreateLocationDto,
  CreateWarehouseDto,
  LocationQueryDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';

// Reads: any authenticated user (filters/pickers need them). Mutations: MANAGER+
// (ADMIN is a superuser via RolesGuard). GET /warehouses (nested locations) and
// GET /locations?warehouseId= power the shared selectors.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get('warehouses')
  listWarehouses() {
    return this.warehouses.listWarehouses();
  }

  @Roles(UserRole.MANAGER)
  @Post('warehouses')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.createWarehouse(dto);
  }

  @Roles(UserRole.MANAGER)
  @Patch('warehouses/:id')
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.updateWarehouse(id, dto);
  }

  @Get('locations')
  listLocations(@Query() query: LocationQueryDto) {
    return this.warehouses.listLocations(query.warehouseId);
  }

  @Roles(UserRole.MANAGER)
  @Post('locations')
  createLocation(@Body() dto: CreateLocationDto) {
    return this.warehouses.createLocation(dto);
  }
}
