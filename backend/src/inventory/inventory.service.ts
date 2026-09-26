import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginated, paginate, toSkipTake } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockQuantRepository } from './stock-quant.repository';
import {
  LocationOption,
  LocationStock,
  StockBreakdown,
  StockKpis,
  StockRow,
} from './stock-row';

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

  /**
   * The parts behind free-to-use and forecast. Totals are summed from the
   * parts (in Decimal), so the explanation always adds up on screen.
   */
  async breakdown(productId: string): Promise<StockBreakdown> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, uom: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [locations, { reservedBy, incomingFrom }] = await Promise.all([
      this.repo.byLocation(productId),
      this.repo.openDocuments(productId),
    ]);
    const sum = (qtys: number[]) =>
      qtys.reduce((t, q) => t.plus(q), new Prisma.Decimal(0));
    const onHand = sum(locations.map((l) => l.qty));
    const reserved = sum(reservedBy.map((d) => d.qty));
    const incoming = sum(incomingFrom.map((d) => d.qty));
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      uom: product.uom,
      onHand: onHand.toNumber(),
      reserved: reserved.toNumber(),
      freeToUse: onHand.minus(reserved).toNumber(),
      incoming: incoming.toNumber(),
      forecast: onHand.plus(incoming).minus(reserved).toNumber(),
      locations,
      reservedBy,
      incomingFrom,
    };
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
