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
  CreateDeliveryDto,
  OperationQueryDto,
  UpdateDeliveryDto,
  ValidateDeliveryDto,
} from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(query: OperationQueryDto) {
    const where: Prisma.DeliveryWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.partnerId) {
      where.partnerId = query.partnerId;
    }
    if (query.search) {
      where.OR = [
        { partner: { name: { contains: query.search, mode: 'insensitive' } } },
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
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        ...toSkipTake(query),
        orderBy: { createdAt: 'desc' },
        include: {
          partner: true,
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
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }
    return delivery;
  }

  async create(dto: CreateDeliveryDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A delivery order must have at least one line item');
    }

    return this.prisma.delivery.create({
      data: {
        partnerId: dto.partnerId ?? null,
        status: DocStatus.DRAFT,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            qty: new Prisma.Decimal(l.qty),
          })),
        },
      },
      include: {
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateDeliveryDto) {
    const delivery = await this.findOne(id);
    if (delivery.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot edit a validated delivery');
    }
    if (delivery.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot edit a canceled delivery');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.deliveryLine.deleteMany({ where: { deliveryId: id } });
        await tx.deliveryLine.createMany({
          data: dto.lines.map((l) => ({
            deliveryId: id,
            productId: l.productId,
            qty: new Prisma.Decimal(l.qty),
          })),
        });
      }

      return tx.delivery.update({
        where: { id },
        data: {
          partnerId: dto.partnerId !== undefined ? dto.partnerId : delivery.partnerId,
          status: dto.status ?? delivery.status,
        },
        include: {
          partner: true,
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
    const delivery = await this.findOne(id);
    if (delivery.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot change status of a validated delivery');
    }
    if (delivery.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot change status of a canceled delivery');
    }
    if (status === DocStatus.DONE) {
      throw new BadRequestException('Use the validate endpoint to mark a delivery as DONE');
    }

    return this.prisma.delivery.update({
      where: { id },
      data: { status },
      include: {
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async validate(id: string, dto: ValidateDeliveryDto, userId?: string) {
    const delivery = await this.findOne(id);
    if (delivery.status === DocStatus.DONE) {
      throw new BadRequestException('Delivery is already validated');
    }
    if (delivery.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot validate a canceled delivery');
    }
    if (!delivery.lines || delivery.lines.length === 0) {
      throw new BadRequestException('Cannot validate a delivery with no lines');
    }

    // Verify location exists
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException(`Source location ${dto.locationId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of delivery.lines) {
        await this.stockService.postMove(
          {
            productId: line.productId,
            qty: line.qty.toNumber(),
            moveType: MoveType.DELIVERY,
            fromLocationId: dto.locationId,
            docType: 'delivery',
            docId: delivery.id,
            createdById: userId ?? null,
          },
          tx,
        );
      }

      return tx.delivery.update({
        where: { id },
        data: {
          status: DocStatus.DONE,
          validatedAt: new Date(),
        },
        include: {
          partner: true,
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
    const delivery = await this.findOne(id);
    if (delivery.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot cancel a validated delivery');
    }
    return this.prisma.delivery.update({
      where: { id },
      data: { status: DocStatus.CANCELED },
      include: {
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}
