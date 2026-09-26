import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { DocStatus } from '@prisma/client';
export { OperationQueryDto } from './operation-query.dto';

export class AdjustmentLineDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  recordedQty?: number;
}

export class CreateAdjustmentDto {
  @IsUUID()
  locationId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentLineDto)
  lines: AdjustmentLineDto[];
}

export class UpdateAdjustmentDto {
  @IsOptional()
  @IsEnum(DocStatus)
  status?: DocStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentLineDto)
  lines?: AdjustmentLineDto[];
}
