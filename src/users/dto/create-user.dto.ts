import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsIn(['ADMIN', 'CUSTOMER'])
  @IsOptional()
  role?: 'ADMIN' | 'CUSTOMER';
}
