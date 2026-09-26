import { IsNumber, IsOptional, Min } from 'class-validator';

export class ReorderRuleDto {
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Minimum must be a number with at most 3 decimals' })
  @Min(0, { message: 'Minimum cannot be negative' })
  minQty!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Maximum must be a number with at most 3 decimals' })
  @Min(0, { message: 'Maximum cannot be negative' })
  maxQty?: number | null;
}
