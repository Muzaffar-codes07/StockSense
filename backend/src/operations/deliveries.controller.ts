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
import { DocStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import {
  CreateDeliveryDto,
  OperationQueryDto,
  UpdateDeliveryDto,
  ValidateDeliveryDto,
} from './dto/delivery.dto';
import { DeliveriesService } from './deliveries.service';

// Reads: any signed-in user. Changes (create, edit, status, validate, cancel):
// MANAGER+, ADMIN always — goods in/out of the company are a manager's call.
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Roles(UserRole.MANAGER)
  @Post()
  create(@Body() dto: CreateDeliveryDto) {
    return this.deliveries.create(dto);
  }

  @Roles(UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    return this.deliveries.update(id, dto);
  }

  @Roles(UserRole.MANAGER)
  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocStatus,
  ) {
    return this.deliveries.updateStatus(id, status);
  }

  @Roles(UserRole.MANAGER)
  @Post(':id/validate')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateDeliveryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deliveries.validate(id, dto, user.sub);
  }

  @Roles(UserRole.MANAGER)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveries.cancel(id);
  }
}
