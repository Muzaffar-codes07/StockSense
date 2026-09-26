import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, MoveType, Prisma } from '@prisma/client';
import { isForeignKeyViolation, isUniqueViolation } from '../common/prisma-errors';
import { StockQueryDto } from '../inventory/dto/stock-query.dto';
import { InventoryService } from '../inventory/inventory.service';
import { LocationStock } from '../inventory/stock-row';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ReorderRuleDto } from './dto/reorder-rule.dto';

export const SKU_TAKEN = 'SKU already exists';

export interface ReorderRuleView {
  minQty: number;
  maxQty: number | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unitCost: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
  reorderRule: ReorderRuleView | null;
  locations: LocationStock[];
  createdAt: Date;
  updatedAt: Date;
}

const toRuleView = (r: { minQty: Prisma.Decimal; maxQty: Prisma.Decimal | null }): ReorderRuleView => ({
  minQty: Number(r.minQty),
  maxQty: r.maxQty === null ? null : Number(r.maxQty),
});

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly inventory: InventoryService,
  ) {}

  list(q: StockQueryDto) {
    return this.inventory.list(q);
  }

  async findOne(id: string): Promise<ProductDetail> {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, reorderRules: true },
    });
    if (!p) throw new NotFoundException('Product not found');
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      uom: p.uom,
      unitCost: Number(p.unitCost),
      isActive: p.isActive,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
      reorderRule: p.reorderRules[0] ? toRuleView(p.reorderRules[0]) : null,
      locations: await this.inventory.locations(id),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  /** Creates the product and, optionally, its opening stock — atomically. */
  async create(dto: CreateProductDto, userId: string): Promise<ProductDetail> {
    const { initialStock, ...data } = dto;
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({ data });
        if (initialStock) {
          const toLocationId =
            initialStock.locationId ?? (await this.defaultStockLocationId(tx));
          await this.stock.postMove(
            {
              productId: created.id,
              qty: initialStock.qty,
              moveType: MoveType.ADJUSTMENT,
              toLocationId,
              docType: 'initial',
              docId: created.id,
              createdById: userId,
            },
            tx,
          );
        }
        return created;
      });
      return this.findOne(product.id);
    } catch (e) {
      throw this.translate(e);
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    await this.ensureExists(id);
    try {
      await this.prisma.product.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.translate(e);
    }
    return this.findOne(id);
  }

  /** Archived products keep their ledger history but leave every list. */
  async archive(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async setReorderRule(id: string, dto: ReorderRuleDto): Promise<ReorderRuleView> {
    const maxQty = dto.maxQty ?? null;
    if (maxQty !== null && maxQty < dto.minQty) {
      throw new BadRequestException('Maximum must be greater than or equal to minimum');
    }
    await this.ensureExists(id);
    const rule = await this.prisma.reorderRule.upsert({
      where: { productId: id },
      create: { productId: id, minQty: dto.minQty, maxQty },
      update: { minQty: dto.minQty, maxQty },
    });
    return toRuleView(rule);
  }

  async removeReorderRule(id: string): Promise<void> {
    await this.prisma.reorderRule.deleteMany({ where: { productId: id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { id } });
    if (!count) throw new NotFoundException('Product not found');
  }

  private async defaultStockLocationId(tx: Prisma.TransactionClient): Promise<string> {
    const location = await tx.location.findFirst({
      where: { type: LocationType.STOCK },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException('Create a stock location before adding initial stock');
    }
    return location.id;
  }

  private translate(e: unknown): unknown {
    if (isUniqueViolation(e)) return new ConflictException(SKU_TAKEN);
    if (isForeignKeyViolation(e)) return new BadRequestException('Category or location not found');
    return e;
  }
}
