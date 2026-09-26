import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.dto';

// Treat empty-string query params (e.g. `?status=` sent by the UI when a
// filter is set to "All") as absent so @IsOptional skips validation.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class OperationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(DocStatus)
  status?: DocStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  partnerId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  locationId?: string;
}
