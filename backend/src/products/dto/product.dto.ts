import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { normalizeSku, SKU_PATTERN } from '../sku';

export const UOMS = ['unit', 'kg', 'g', 'l', 'ml', 'm', 'box'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class InitialStockDto {
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Initial quantity must be a number with at most 3 decimals' },
  )
  @Min(0.001, { message: 'Initial quantity must be greater than 0' })
  qty!: number;

  @IsOptional()
  @IsUUID('all', { message: 'Pick a valid location' })
  locationId?: string;
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(120, { message: 'Name must be at most 120 characters' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? normalizeSku(value) : value))
  @IsString()
  @Matches(SKU_PATTERN, {
    message: 'SKU must be 1-32 letters, digits, dot, dash or underscore',
  })
  sku!: string;

  @IsOptional()
  @IsUUID('all', { message: 'Pick a valid category' })
  categoryId?: string | null;

  @IsOptional()
  @IsIn(UOMS, { message: `Unit must be one of: ${UOMS.join(', ')}` })
  uom?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Unit cost must have at most 2 decimals' })
  @Min(0, { message: 'Unit cost cannot be negative' })
  unitCost?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialStockDto)
  initialStock?: InitialStockDto;
}

// Initial stock only makes sense at creation; later changes go through operations.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['initialStock'] as const),
) {}
