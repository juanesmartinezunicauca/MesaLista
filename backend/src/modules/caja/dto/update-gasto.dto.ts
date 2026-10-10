import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGastoDto {
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La descripción no puede superar los 255 caracteres.' })
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El total debe ser un número válido.' })
  @Min(1, { message: 'El total del gasto debe ser mayor a 0.' })
  total?: number;

  @IsOptional()
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El tipo de gasto no puede superar los 50 caracteres.' })
  tipo_gasto?: string;

  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El medio de pago no puede superar los 50 caracteres.' })
  medio_pago?: string;

  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
