import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AsOfQueryDto } from './dto/as-of-query.dto';
import { LedgerService } from './ledger.service';

@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('integrity')
  integrity() {
    return this.ledger.integrity();
  }

  @Get('as-of')
  asOf(@Query() query: AsOfQueryDto) {
    return this.ledger.asOf(query);
  }
}
