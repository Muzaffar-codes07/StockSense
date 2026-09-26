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
  CreateReceiptDto,
  OperationQueryDto,
  UpdateReceiptDto,
  ValidateReceiptDto,
} from './dto/receipt.dto';
import { assertNotMarkingDone, cancelIfOpen, claimForValidation } from './document-status';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async list(query: OperationQueryDto) {
    const where: Prisma.ReceiptWhereInput = {};
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
      this.prisma.receipt.count({ where }),
      this.prisma.receipt.findMany({
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
    const receipt = await this.prisma.receipt.findUnique({
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
    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }
    return receipt;
  }

  async create(dto: CreateReceiptDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A receipt must have at least one line item');
    }

    return this.prisma.receipt.create({
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

  async update(id: string, dto: UpdateReceiptDto) {
    const receipt = await this.findOne(id);
    if (receipt.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot edit a validated receipt');
    }
    if (receipt.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot edit a canceled receipt');
    }

    assertNotMarkingDone(dto.status, 'receipt');

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.receiptLine.deleteMany({ where: { receiptId: id } });
        await tx.receiptLine.createMany({
          data: dto.lines.map((l) => ({
            receiptId: id,
            productId: l.productId,
            qty: new Prisma.Decimal(l.qty),
          })),
        });
      }

      return tx.receipt.update({
        where: { id },
        data: {
          partnerId: dto.partnerId !== undefined ? dto.partnerId : receipt.partnerId,
          status: dto.status ?? receipt.status,
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
    const receipt = await this.findOne(id);
    if (receipt.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot change status of a validated receipt');
    }
    if (receipt.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot change status of a canceled receipt');
    }
    if (status === DocStatus.DONE) {
      throw new BadRequestException('Use the validate endpoint to mark a receipt as DONE');
    }

    return this.prisma.receipt.update({
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

  async validate(id: string, dto: ValidateReceiptDto, userId?: string) {
    const receipt = await this.findOne(id);
    if (receipt.status === DocStatus.DONE) {
      throw new BadRequestException('Receipt is already validated');
    }
    if (receipt.status === DocStatus.CANCELED) {
      throw new BadRequestException('Cannot validate a canceled receipt');
    }
    if (!receipt.lines || receipt.lines.length === 0) {
      throw new BadRequestException('Cannot validate a receipt with no lines');
    }

    // Verify location exists
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException(`Destination location ${dto.locationId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await claimForValidation(tx.receipt, id, 'Receipt');
      for (const line of receipt.lines) {
        await this.stockService.postMove(
          {
            productId: line.productId,
            qty: line.qty.toNumber(),
            moveType: MoveType.RECEIPT,
            toLocationId: dto.locationId,
            docType: 'receipt',
            docId: receipt.id,
            createdById: userId ?? null,
          },
          tx,
        );
      }

      return tx.receipt.update({
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
    const receipt = await this.findOne(id);
    if (receipt.status === DocStatus.DONE) {
      throw new BadRequestException('Cannot cancel a validated receipt');
    }
    await cancelIfOpen(this.prisma.receipt, id, 'Receipt');
    return this.findOne(id);
  }
}
