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
  CreateReceiptDto,
  OperationQueryDto,
  UpdateReceiptDto,
  ValidateReceiptDto,
} from './dto/receipt.dto';
import { ReceiptsService } from './receipts.service';

@UseGuards(JwtAuthGuard)
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

  @Post()
  create(@Body() dto: CreateReceiptDto) {
    return this.receipts.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receipts.update(id, dto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocStatus,
  ) {
    return this.receipts.updateStatus(id, status);
  }

  @Post(':id/validate')
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receipts.validate(id, dto, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.cancel(id);
  }
}
