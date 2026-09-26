import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, paginate, toSkipTake } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockQuantRepository } from './stock-quant.repository';
import { LocationOption, LocationStock, StockKpis, StockRow } from './stock-row';

const ALERT_LIMIT = 50;

@Injectable()
export class InventoryService {
  constructor(
    private readonly repo: StockQuantRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(q: StockQueryDto): Promise<Paginated<StockRow>> {
    const { skip, take } = toSkipTake(q);
    const { rows, total } = await this.repo.findRows({
      search: q.search,
      categoryId: q.categoryId,
      statuses: q.status ? [q.status] : undefined,
      skip,
      take,
    });
    return paginate(rows, total, q);
  }

  async alerts(): Promise<StockRow[]> {
    const { rows } = await this.repo.findRows({ statuses: ['OUT', 'LOW'], take: ALERT_LIMIT });
    return rows;
  }

  kpis(): Promise<StockKpis> {
    return this.repo.kpis();
  }

  async locations(productId: string): Promise<LocationStock[]> {
    const exists = await this.prisma.product.count({ where: { id: productId } });
    if (!exists) throw new NotFoundException('Product not found');
    return this.repo.byLocation(productId);
  }

  async allLocations(): Promise<LocationOption[]> {
    const locations = await this.prisma.location.findMany({
      orderBy: [{ warehouse: { name: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, type: true, warehouse: { select: { name: true } } },
    });
    return locations.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      warehouseName: l.warehouse.name,
    }));
  }
}
