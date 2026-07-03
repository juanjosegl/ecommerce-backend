import { IsString, IsNumber, IsOptional, IsObject, Min } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  sku: string;

  @IsObject()
  attributes: Record<string, string>;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  initialStock?: number;
}
