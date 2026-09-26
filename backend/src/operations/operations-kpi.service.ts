import { Injectable } from '@nestjs/common';
import { DocStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationsKpiService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpiCounts() {
    const pendingStatuses = [
      DocStatus.DRAFT,
      DocStatus.WAITING,
      DocStatus.READY,
    ];

    const [pendingReceipts, pendingDeliveries, scheduledTransfers] =
      await Promise.all([
        this.prisma.receipt.count({
          where: { status: { in: pendingStatuses } },
        }),
        this.prisma.delivery.count({
          where: { status: { in: pendingStatuses } },
        }),
        this.prisma.transfer.count({
          where: { status: { in: pendingStatuses } },
        }),
      ]);

    return {
      pendingReceipts,
      pendingDeliveries,
      scheduledTransfers,
    };
  }
}
