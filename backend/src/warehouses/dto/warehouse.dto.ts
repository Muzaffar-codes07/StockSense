import { LocationType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateLocationDto {
  @IsString()
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class LocationQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
