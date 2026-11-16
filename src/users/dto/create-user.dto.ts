import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { PersonName, StrongPassword } from '../../auth/dto/password.rules';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @StrongPassword()
  password: string;

  @PersonName()
  firstName: string;

  @PersonName()
  lastName: string;

  @IsIn(['ADMIN', 'CUSTOMER'])
  @IsOptional()
  role?: 'ADMIN' | 'CUSTOMER';
}
