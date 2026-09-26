import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MoveType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.dto';

// Treat empty-string query params (sent by the UI when a filter is "All"/blank)
// as absent so @IsOptional skips validation instead of 400-ing.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class MoveHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  fromLocationId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  toLocationId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  locationId?: string; // filters either fromLocationId or toLocationId

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(MoveType)
  moveType?: MoveType;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  docType?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  docId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  endDate?: string;
}
