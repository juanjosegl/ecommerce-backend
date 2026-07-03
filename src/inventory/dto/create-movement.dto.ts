import { IsString, IsInt, IsIn, Min } from 'class-validator';

export class CreateMovementDto {
  @IsString()
  variantId: string;

  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  reason: string;
}
