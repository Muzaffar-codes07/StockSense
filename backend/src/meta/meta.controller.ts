import { Controller, Get } from '@nestjs/common';
import { DocStatus, LocationType, MoveType } from '@prisma/client';

// Single source of truth for enum values the frontend needs for filters/badges
// (the frontend can't import @prisma/client). Static, so left unguarded.
@Controller('meta')
export class MetaController {
  @Get('enums')
  enums() {
    return {
      docStatuses: Object.values(DocStatus), // DRAFT, WAITING, READY, DONE, CANCELED
      moveTypes: Object.values(MoveType), // RECEIPT, DELIVERY, INTERNAL, ADJUSTMENT
      locationTypes: Object.values(LocationType), // STOCK, PRODUCTION, RACK, TRANSIT
    };
  }
}
