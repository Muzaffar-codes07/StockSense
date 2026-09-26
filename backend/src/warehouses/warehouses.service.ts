import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLocationDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';

// Role 1 owns warehouses + locations (the multi-warehouse model + Settings).
// Read endpoints here are what Roles 2/3/4 use for filter dropdowns and the
// source/destination selectors on operation documents.
@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // Warehouses with their locations nested — one call gives the whole tree
  // for filter dropdowns.
  listWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: { locations: { orderBy: { name: 'asc' } } },
    });
  }

  createWarehouse(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    await this.ensureWarehouse(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  // Flat location list, optionally scoped to one warehouse — the shape most
  // location pickers/filters want.
  listLocations(warehouseId?: string) {
    return this.prisma.location.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      orderBy: [{ warehouseId: 'asc' }, { name: 'asc' }],
    });
  }

  async createLocation(dto: CreateLocationDto) {
    await this.ensureWarehouse(dto.warehouseId);
    return this.prisma.location.create({ data: dto });
  }

  private async ensureWarehouse(id: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Warehouse not found');
  }
}
