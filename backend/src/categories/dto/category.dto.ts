import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(60, { message: 'Category name must be at most 60 characters' })
  name!: string;
}
