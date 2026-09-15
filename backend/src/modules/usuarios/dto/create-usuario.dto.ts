import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export enum RolUsuario {
  administrador = 'administrador',
  cajero = 'cajero',
  mesero = 'mesero',
  cocina = 'cocina',
}

export enum EstadoUsuario {
  activo = 'activo',
  inactivo = 'inactivo',
}

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

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  password!: string;

  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero o cocina',
  })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  rol!: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;
}
