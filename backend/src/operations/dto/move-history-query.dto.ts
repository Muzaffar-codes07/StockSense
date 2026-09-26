import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MoveType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class MoveHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string; // filters either fromLocationId or toLocationId

  @IsOptional()
  @IsEnum(MoveType)
  moveType?: MoveType;

  @IsOptional()
  @IsString()
  docType?: string;

  @IsOptional()
  @IsString()
  docId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
