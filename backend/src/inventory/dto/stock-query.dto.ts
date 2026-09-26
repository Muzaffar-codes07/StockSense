import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { STOCK_STATUSES, StockStatus } from '../stock-row';

// GET /stock and GET /products: ?search&categoryId&status&page&pageSize
export class StockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'categoryId must be a valid id' })
  categoryId?: string;

  // Case-insensitive (?status=low works); an empty ?status= means no filter.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
  )
  @IsIn(STOCK_STATUSES, { message: 'status must be one of OK, LOW, OUT' })
  status?: StockStatus;
}
