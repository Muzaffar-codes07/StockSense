import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';
import { AdjustmentsController } from './adjustments.controller';
import { AdjustmentsService } from './adjustments.service';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { MoveHistoryController } from './move-history.controller';
import { MoveHistoryService } from './move-history.service';
import { OperationsKpiService } from './operations-kpi.service';
import { OperationsController } from './operations.controller';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [PrismaModule, StockModule],
  controllers: [
    OperationsController,
    ReceiptsController,
    DeliveriesController,
    TransfersController,
    AdjustmentsController,
    MoveHistoryController,
    PartnersController,
  ],
  providers: [
    OperationsKpiService,
    ReceiptsService,
    DeliveriesService,
    TransfersService,
    AdjustmentsService,
    MoveHistoryService,
    PartnersService,
  ],
  exports: [
    OperationsKpiService,
    ReceiptsService,
    DeliveriesService,
    TransfersService,
    AdjustmentsService,
    MoveHistoryService,
    PartnersService,
  ],
})
export class OperationsModule {}
