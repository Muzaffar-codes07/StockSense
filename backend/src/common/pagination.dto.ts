import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Shared list/filter convention (Phase 0 contract #5). Every list endpoint
// extends this so Roles 3 & 4 build filters the same way. Example:
//   GET /products?page=1&pageSize=20&search=steel&categoryId=...&status=DONE
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Turns a page/pageSize into Prisma skip/take.
export function toSkipTake(q: PaginationQueryDto) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

// Wraps rows + count into the standard paginated envelope.
export function paginate<T>(
  data: T[],
  total: number,
  q: PaginationQueryDto,
): Paginated<T> {
  return {
    data,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.ceil(total / q.pageSize),
  };
}
