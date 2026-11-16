import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ShippingAddressDto {
  @Transform(trim)
  @IsString()
  @Length(3, 100)
  @Matches(/^[\p{L}][\p{L}\s'.-]*$/u, { message: 'Nombre inválido' })
  fullName: string;

  /** Colombian mobile: 10 digits starting with 3 */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @Matches(/^3\d{9}$/, { message: 'Celular inválido' })
  phone: string;

  @Transform(trim)
  @IsString()
  @Length(5, 200)
  address: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city: string;

  @Transform(trim)
  @IsString()
  @Length(2, 60)
  department: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
