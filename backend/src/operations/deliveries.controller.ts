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
import {
  CreateDeliveryDto,
  OperationQueryDto,
  UpdateDeliveryDto,
  ValidateDeliveryDto,
} from './dto/delivery.dto';
import { DeliveriesService } from './deliveries.service';

@UseGuards(JwtAuthGuard)
@Controller('operations/deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  list(@Query() query: OperationQueryDto) {
    return this.deliveries.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDeliveryDto) {
    return this.deliveries.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    return this.deliveries.update(id, dto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocStatus,
  ) {
    return this.deliveries.updateStatus(id, status);
  }

  @Post(':id/validate')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateDeliveryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliveries.validate(id, dto, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.cancel(id);
  }
}
