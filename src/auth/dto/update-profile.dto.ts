import { IsOptional } from 'class-validator';
import { PersonName } from './password.rules';

export class UpdateProfileDto {
  @IsOptional()
  @PersonName()
  firstName?: string;

  @IsOptional()
  @PersonName()
  lastName?: string;
}
