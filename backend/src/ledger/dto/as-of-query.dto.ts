import {
  IsDefined,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class AsOfQueryDto {
  @IsDefined()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/, {
    message: 'at must be an ISO datetime with a timezone',
  })
  at!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}
