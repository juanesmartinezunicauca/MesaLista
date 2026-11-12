import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { EstadoUsuario, RolUsuario } from './create-usuario.dto';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del colaborador',
    example: 'Carlos Mendoza Editado',
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario / alias operativo',
    example: 'carlos_mendoza',
  })
  @IsOptional()
  @IsString({ message: 'El usuario debe ser una cadena de texto' })
  @Length(3, 50, { message: 'El nombre de usuario debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  usuario?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del colaborador',
    example: 'carlos.m@restaurante.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @Length(5, 100, { message: 'El correo electrónico debe tener entre 5 y 100 caracteres' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña de contingencia hasheada en Argon2id',
    example: 'NuevaClave2026',
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password?: string;

  @ApiPropertyOptional({
    description: 'Rol operativo',
    enum: RolUsuario,
  })
  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero, cocina o cliente',
  })
  rol?: RolUsuario;

  @ApiPropertyOptional({
    description: 'Estado del usuario',
    enum: EstadoUsuario,
  })
  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;
}
