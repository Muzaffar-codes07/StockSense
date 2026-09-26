import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class OperationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DocStatus)
  status?: DocStatus;

  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
