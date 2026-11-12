import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * DTO para actualización de datos del perfil autenticado
 */
export class UpdatePerfilDto {
  @ApiPropertyOptional({
    description: 'Nombre completo o visible del usuario',
    example: 'Juan Esteban Martinez',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña de contingencia (mínimo 8 caracteres, al menos una letra y un número)',
    example: 'NuevaClave2026',
    minLength: 8,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password?: string;
}
