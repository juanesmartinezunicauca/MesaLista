import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { EstadoUsuario, RolUsuario } from './create-usuario.dto';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'El usuario debe ser una cadena de texto' })
  @Length(3, 50, { message: 'El nombre de usuario debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  usuario?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  password?: string;

  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero o cocina',
  })
  rol?: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;
}
