import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Same policy the frontend enforces: 8-72 chars with at least one letter and one digit. */
export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(72), // bcrypt ignores bytes beyond 72
    Matches(/^(?=.*\p{L})(?=.*\d).+$/u, {
      message: 'La contraseña debe incluir al menos una letra y un número',
    }),
  );

/** Person name: trimmed, 2-50 chars, letters with spaces, apostrophes or hyphens. */
export const PersonName = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    MinLength(2),
    MaxLength(50),
    Matches(/^[\p{L}][\p{L}\s'-]*$/u, { message: 'Nombre inválido' }),
  );
