import { IsString, IsOptional, IsNumber, IsUrl } from 'class-validator';

export class AddImageDto {
  @IsUrl()
  url: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  variantId?: string;
}
