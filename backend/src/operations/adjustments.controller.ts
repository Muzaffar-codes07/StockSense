import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AdjustmentsService } from './adjustments.service';
import {
  CreateAdjustmentDto,
  OperationQueryDto,
  UpdateAdjustmentDto,
} from './dto/adjustment.dto';

@UseGuards(JwtAuthGuard)
@Controller('operations/adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Get()
  list(@Query() query: OperationQueryDto) {
    return this.adjustments.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAdjustmentDto) {
    return this.adjustments.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdjustmentDto,
  ) {
    return this.adjustments.update(id, dto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocStatus,
  ) {
    return this.adjustments.updateStatus(id, status);
  }

  @Post(':id/validate')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adjustments.validate(id, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.adjustments.cancel(id);
  }
}
