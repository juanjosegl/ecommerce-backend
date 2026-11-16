import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';
import { PersonName, StrongPassword } from './password.rules';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  email: string;

  @StrongPassword()
  password: string;

  @PersonName()
  firstName: string;

  @PersonName()
  lastName: string;
}
