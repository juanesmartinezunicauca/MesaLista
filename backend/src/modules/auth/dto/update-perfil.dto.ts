import { IsOptional, IsString, Length } from 'class-validator';

export class UpdatePerfilDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @Length(6, 100, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;
}
