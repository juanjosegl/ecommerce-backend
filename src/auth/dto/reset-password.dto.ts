import { IsString } from 'class-validator';
import { StrongPassword } from './password.rules';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @StrongPassword()
  newPassword: string;
}
