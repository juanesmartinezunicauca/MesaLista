import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { EstadoUsuario, RolUsuario } from '@prisma/client';

export { EstadoUsuario, RolUsuario };


export class CreateUsuarioDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre!: string;

  @IsString({ message: 'El usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  @Length(3, 50, { message: 'El nombre de usuario debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  usuario!: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @Length(5, 100, { message: 'El correo electrónico debe tener entre 5 y 100 caracteres' })
  email?: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  password!: string;

  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero, cocina o cliente',
  })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  rol!: RolUsuario;


  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;
}
