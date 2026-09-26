import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperationsKpiService } from './operations-kpi.service';

@UseGuards(JwtAuthGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly kpiService: OperationsKpiService) {}

  @Get('kpi-counts')
  getKpiCounts() {
    return this.kpiService.getKpiCounts();
  }
}
