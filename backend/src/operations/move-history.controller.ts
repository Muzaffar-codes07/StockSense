import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MoveHistoryQueryDto } from './dto/move-history-query.dto';
import { MoveHistoryService } from './move-history.service';

@UseGuards(JwtAuthGuard)
@Controller('operations/moves')
export class MoveHistoryController {
  constructor(private readonly moveHistory: MoveHistoryService) {}

  @Get()
  list(@Query() query: MoveHistoryQueryDto) {
    return this.moveHistory.list(query);
  }
}
