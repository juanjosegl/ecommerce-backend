import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}
