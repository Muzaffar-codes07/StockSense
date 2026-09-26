import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { STOCK_STATUSES, StockStatus } from '../stock-row';

// GET /stock and GET /products: ?search&categoryId&status&page&pageSize
export class StockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'categoryId must be a valid id' })
  categoryId?: string;

  @IsOptional()
  @IsIn(STOCK_STATUSES, { message: 'status must be one of OK, LOW, OUT' })
  status?: StockStatus;
}
