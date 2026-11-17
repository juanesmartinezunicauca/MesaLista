import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

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
}
