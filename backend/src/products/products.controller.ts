import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { StockQueryDto } from '../inventory/dto/stock-query.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ReorderRuleDto } from './dto/reorder-rule.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() q: StockQueryDto) {
    return this.products.list(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.archive(id);
  }

  @Put(':id/reorder-rule')
  setReorderRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderRuleDto) {
    return this.products.setReorderRule(id, dto);
  }

  @Delete(':id/reorder-rule')
  @HttpCode(204)
  removeReorderRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.removeReorderRule(id);
  }
}
