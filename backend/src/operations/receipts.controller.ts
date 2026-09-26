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
  CreateReceiptDto,
  OperationQueryDto,
  UpdateReceiptDto,
  ValidateReceiptDto,
} from './dto/receipt.dto';
import { ReceiptsService } from './receipts.service';

// Reads: any signed-in user. Changes (create, edit, status, validate, cancel):
// MANAGER+, ADMIN always — goods in/out of the company are a manager's call.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operations/receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  list(@Query() query: OperationQueryDto) {
    return this.receipts.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.findOne(id);
  }

  @Roles(UserRole.MANAGER)
  @Post()
  create(@Body() dto: CreateReceiptDto) {
    return this.receipts.create(dto);
  }

  @Roles(UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receipts.update(id, dto);
  }

  @Roles(UserRole.MANAGER)
  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocStatus,
  ) {
    return this.receipts.updateStatus(id, status);
  }

  @Roles(UserRole.MANAGER)
  @Post(':id/validate')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receipts.validate(id, dto, user.sub);
  }

  @Roles(UserRole.MANAGER)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.cancel(id);
  }
}
