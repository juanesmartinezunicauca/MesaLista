import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CambiarEstadoDomicilioDto {
  @IsNotEmpty({ message: 'El estado o acción es requerido.' })
  @IsString({ message: 'El estado debe ser texto.' })
  estado!: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;

  @IsOptional()
  @IsString({ message: 'El nombre del domiciliario debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre del repartidor no puede superar los 100 caracteres.' })
  repartidor_nombre?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono del domiciliario debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono del repartidor no puede superar los 30 caracteres.' })
  repartidor_telefono?: string;
}
