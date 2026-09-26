import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartnerType } from '@prisma/client';

export class PartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PartnerType)
  type: PartnerType;
}

export class PartnerQueryDto {
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @IsOptional()
  @IsString()
  search?: string;
}
