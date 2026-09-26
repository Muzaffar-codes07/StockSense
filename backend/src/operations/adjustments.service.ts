import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocStatus, MoveType, Prisma } from '@prisma/client';
import { paginate, toSkipTake } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import {
  CreateAdjustmentDto,
  OperationQueryDto,
  UpdateAdjustmentDto,
} from './dto/adjustment.dto';
import { assertNotMarkingDone, cancelIfOpen, claimForValidation } from './document-status';

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(query: OperationQueryDto) {
    const where: Prisma.AdjustmentWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.search) {
      where.OR = [
        { location: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          lines: {
            some: {
              product: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { sku: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.adjustment.count({ where }),
      this.prisma.adjustment.findMany({
        where,
        ...toSkipTake(query),
        orderBy: { createdAt: 'desc' },
        include: {
          location: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const adjustment = await this.prisma.adjustment.findUnique({
      where: { id },
      include: {
        location: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!adjustment) {
      throw new NotFoundException(`Adjustment with ID ${id} not found`);
    }
    return adjustment;
  }

  async create(dto: CreateAdjustmentDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'An inventory adjustment must have at least one line item',
      );
    }

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location with ID ${dto.locationId} not found`);
    }

    // Resolve recordedQty and diff for all lines
    const preparedLines = await Promise.all(
      dto.lines.map(async (line) => {
        let recorded = line.recordedQty;
        if (recorded === undefined || recorded === null) {
          recorded = await this.stockService.stockOnHand(
            line.productId,
            dto.locationId,
          );
        }
        const diff = line.countedQty - recorded;
        return {
          productId: line.productId,
          countedQty: new Prisma.Decimal(line.countedQty),
          recordedQty: new Prisma.Decimal(recorded),
          diff: new Prisma.Decimal(diff),
        };
      }),
    );

    return this.prisma.adjustment.create({
      data: {
        locationId: dto.locationId,
        status: DocStatus.DRAFT,
        lines: {
          create: preparedLines,
        },
      },
      include: {
        location: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateAdjustmentDto) {
    const adjustment = await this.findOne(id);
    if (adjustment.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot edit a validated adjustment');
    }
    if (adjustment.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot edit a canceled adjustment');
    }

    assertNotMarkingDone(dto.status, 'adjustment');

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        const preparedLines = await Promise.all(
          dto.lines.map(async (line) => {
            let recorded = line.recordedQty;
            if (recorded === undefined || recorded === null) {
              recorded = await this.stockService.stockOnHand(
                line.productId,
                adjustment.locationId,
              );
            }
            const diff = line.countedQty - recorded;
            return {
              adjustmentId: id,
              productId: line.productId,
              countedQty: new Prisma.Decimal(line.countedQty),
              recordedQty: new Prisma.Decimal(recorded),
              diff: new Prisma.Decimal(diff),
            };
          }),
        );

        await tx.adjustmentLine.deleteMany({ where: { adjustmentId: id } });
        await tx.adjustmentLine.createMany({ data: preparedLines });
      }

      return tx.adjustment.update({
        where: { id },
        data: {
          status: dto.status ?? adjustment.status,
        },
        include: {
          location: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async updateStatus(id: string, status: DocStatus) {
    const adjustment = await this.findOne(id);
    if (adjustment.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot change status of a validated adjustment');
    }
    if (adjustment.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot change status of a canceled adjustment');
    }
    if (status === DocStatus.DONE) {
      throw new BadRequestException('Use the validate endpoint to mark an adjustment as DONE');
    }

    return this.prisma.adjustment.update({
      where: { id },
      data: { status },
      include: {
        location: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async validate(id: string, userId?: string) {
    const adjustment = await this.findOne(id);
    if (adjustment.status === DocStatus.DONE) {
      throw new BadRequestException('Adjustment is already validated');
    }
    if (adjustment.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot validate a canceled adjustment');
    }
    if (!adjustment.lines || adjustment.lines.length === 0) {
      throw new BadRequestException('Cannot validate an adjustment with no lines');
    }

    return this.prisma.$transaction(async (tx) => {
      await claimForValidation(tx.adjustment, id, 'Adjustment');
      for (const line of adjustment.lines) {
        // The count is what's true; measure it against on-hand *now*, under the
        // per-location lock, not the preview diff stored at create time (#13).
        await this.stockService.lockStock(line.productId, adjustment.locationId, tx);
        const recorded = await this.stockService.stockOnHand(line.productId, adjustment.locationId, tx);
        const diff = line.countedQty.minus(recorded);
        await tx.adjustmentLine.update({
          where: { id: line.id },
          data: { recordedQty: new Prisma.Decimal(recorded), diff },
        });
        const diffNum = diff.toNumber();
        if (diffNum > 0) {
          // Found more stock -> Move into location
          await this.stockService.postMove(
            {
              productId: line.productId,
              qty: diffNum,
              moveType: MoveType.ADJUSTMENT,
              toLocationId: adjustment.locationId,
              docType: 'adjustment',
              docId: adjustment.id,
              createdById: userId ?? null,
            },
            tx,
          );
        } else if (diffNum < 0) {
          // Stock deficit -> Move out of location
          await this.stockService.postMove(
            {
              productId: line.productId,
              qty: Math.abs(diffNum),
              moveType: MoveType.ADJUSTMENT,
              fromLocationId: adjustment.locationId,
              docType: 'adjustment',
              docId: adjustment.id,
              createdById: userId ?? null,
            },
            tx,
          );
        }
      }

      return tx.adjustment.update({
        where: { id },
        data: {
          status: DocStatus.DONE,
          validatedAt: new Date(),
        },
        include: {
          location: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async cancel(id: string) {
    const adjustment = await this.findOne(id);
    if (adjustment.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot cancel a validated adjustment');
    }
    await cancelIfOpen(this.prisma.adjustment, id, 'Adjustment');
    return this.findOne(id);
  }
}
