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
  CreateTransferDto,
  OperationQueryDto,
  UpdateTransferDto,
} from './dto/transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(query: OperationQueryDto) {
    const where: Prisma.TransferWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.locationId) {
      where.lines = {
        some: {
          OR: [
            { fromLocationId: query.locationId },
            { toLocationId: query.locationId },
          ],
        },
      };
    }
    if (query.search) {
      where.lines = {
        some: {
          product: {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.transfer.count({ where }),
      this.prisma.transfer.findMany({
        where,
        ...toSkipTake(query),
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              product: true,
              fromLocation: true,
              toLocation: true,
            },
          },
        },
      }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    });
    if (!transfer) {
      throw new NotFoundException(`Transfer with ID ${id} not found`);
    }
    return transfer;
  }

  async create(dto: CreateTransferDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A transfer must have at least one line item');
    }

    for (const line of dto.lines) {
      if (line.fromLocationId === line.toLocationId) {
        throw new BadRequestException(
          'Source and destination locations cannot be the same',
        );
      }
    }

    return this.prisma.transfer.create({
      data: {
        status: DocStatus.DRAFT,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            qty: new Prisma.Decimal(l.qty),
            fromLocationId: l.fromLocationId,
            toLocationId: l.toLocationId,
          })),
        },
      },
      include: {
        lines: {
          include: {
            product: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateTransferDto) {
    const transfer = await this.findOne(id);
    if (transfer.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot edit a validated transfer');
    }
    if (transfer.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot edit a canceled transfer');
    }

    if (dto.lines) {
      for (const line of dto.lines) {
        if (line.fromLocationId === line.toLocationId) {
          throw new BadRequestException(
            'Source and destination locations cannot be the same',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.transferLine.deleteMany({ where: { transferId: id } });
        await tx.transferLine.createMany({
          data: dto.lines.map((l) => ({
            transferId: id,
            productId: l.productId,
            qty: new Prisma.Decimal(l.qty),
            fromLocationId: l.fromLocationId,
            toLocationId: l.toLocationId,
          })),
        });
      }

      return tx.transfer.update({
        where: { id },
        data: {
          status: dto.status ?? transfer.status,
        },
        include: {
          lines: {
            include: {
              product: true,
              fromLocation: true,
              toLocation: true,
            },
          },
        },
      });
    });
  }

  async updateStatus(id: string, status: DocStatus) {
    const transfer = await this.findOne(id);
    if (transfer.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot change status of a validated transfer');
    }
    if (transfer.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot change status of a canceled transfer');
    }
    if (status === DocStatus.DONE) {
      throw new BadRequestException('Use the validate endpoint to mark a transfer as DONE');
    }

    return this.prisma.transfer.update({
      where: { id },
      data: { status },
      include: {
        lines: {
          include: {
            product: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    });
  }

  async validate(id: string, userId?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status === DocStatus.DONE) {
      throw new BadRequestException('Transfer is already validated');
    }
    if (transfer.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot validate a canceled transfer');
    }
    if (!transfer.lines || transfer.lines.length === 0) {
      throw new BadRequestException('Cannot validate a transfer with no lines');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        await this.stockService.postMove(
          {
            productId: line.productId,
            qty: line.qty.toNumber(),
            moveType: MoveType.INTERNAL,
            fromLocationId: line.fromLocationId,
            toLocationId: line.toLocationId,
            docType: 'transfer',
            docId: transfer.id,
            createdById: userId ?? null,
          },
          tx,
        );
      }

      return tx.transfer.update({
        where: { id },
        data: {
          status: DocStatus.DONE,
          validatedAt: new Date(),
        },
        include: {
          lines: {
            include: {
              product: true,
              fromLocation: true,
              toLocation: true,
            },
          },
        },
      });
    });
  }

  async cancel(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot cancel a validated transfer');
    }
    return this.prisma.transfer.update({
      where: { id },
      data: { status: DocStatus.CANCELED },
      include: {
        lines: {
          include: {
            product: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    });
  }
}
