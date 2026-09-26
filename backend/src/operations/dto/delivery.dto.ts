import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { DocStatus } from '@prisma/client';
export { OperationQueryDto } from './operation-query.dto';

export class DeliveryLineDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  qty: number;
}

export class CreateDeliveryDto {
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  // No create-time location: Receipt/Delivery have no location column, so the
  // location is chosen at validate (the moment stock actually moves). #14

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryLineDto)
  lines: DeliveryLineDto[];
}

export class UpdateDeliveryDto {
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @IsOptional()
  @IsEnum(DocStatus)
  status?: DocStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryLineDto)
  lines?: DeliveryLineDto[];
}

export class ValidateDeliveryDto {
  @IsUUID()
  locationId: string;
}
