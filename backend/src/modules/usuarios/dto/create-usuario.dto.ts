import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { EstadoUsuario, RolUsuario } from '@prisma/client';

export { EstadoUsuario, RolUsuario };

/**
 * DTO para la creación de un nuevo colaborador en el sistema
 */
export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nombre completo del colaborador',
    example: 'Carlos Mendoza',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario operativo / alias único (autogenerado si se omite)',
    example: 'carlos_mesero',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'El usuario debe ser una cadena de texto' })
  @Length(3, 50, { message: 'El nombre de usuario debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  usuario?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico permanente del colaborador (opcional)',
    example: 'carlos@restaurante.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @Length(5, 100, { message: 'El correo electrónico debe tener entre 5 y 100 caracteres' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Correo efímero de entrega del código de invitación (Garantía de privacidad: NO se almacena en base de datos)',
    example: 'carlos.personal@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo de envío del código no tiene un formato válido' })
  @Length(5, 100, { message: 'El correo de envío debe tener entre 5 y 100 caracteres' })
  correoEnvioCodigo?: string;

  @ApiPropertyOptional({
    description: 'Contraseña de contingencia para acceso local (opcional en enrolamiento Google SSO)',
    example: 'ClaveSegura2026',
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password?: string;

  @ApiProperty({
    description: 'Rol operativo del usuario en el restaurante',
    enum: RolUsuario,
    example: RolUsuario.mesero,
  })
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero, cocina o cliente',
  })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  rol!: RolUsuario;

  @ApiPropertyOptional({
    description: 'Estado del usuario',
    enum: EstadoUsuario,
    default: EstadoUsuario.activo,
  })
  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;
}
