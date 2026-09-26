import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, toSkipTake } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MoveHistoryQueryDto } from './dto/move-history-query.dto';

@Injectable()
export class MoveHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: MoveHistoryQueryDto) {
    const where: Prisma.StockMoveWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.moveType) {
      where.moveType = query.moveType;
    }
    if (query.docType) {
      where.docType = query.docType;
    }
    if (query.docId) {
      where.docId = query.docId;
    }
    if (query.fromLocationId) {
      where.fromLocationId = query.fromLocationId;
    }
    if (query.toLocationId) {
      where.toLocationId = query.toLocationId;
    }
    if (query.locationId) {
      where.OR = [
        { fromLocationId: query.locationId },
        { toLocationId: query.locationId },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.stockMove.count({ where }),
      this.prisma.stockMove.findMany({
        where,
        ...toSkipTake(query),
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          fromLocation: {
            include: {
              warehouse: true,
            },
          },
          toLocation: {
            include: {
              warehouse: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return paginate(data, total, query);
  }
}
