import { IsString, IsNumber, IsOptional, IsObject, IsBoolean, Min } from 'class-validator';

export class AddVariantDto {
  @IsString()
  sku: string;

  @IsObject()
  attributes: Record<string, string>;

  @IsNumber()
  @Min(0)
  price: number;
}

export class UpdateVariantDto {
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
