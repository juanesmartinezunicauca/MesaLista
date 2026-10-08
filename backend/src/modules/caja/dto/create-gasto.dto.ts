import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGastoDto {
  @IsNotEmpty({ message: 'La descripción del gasto es obligatoria.' })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La descripción no puede superar los 255 caracteres.' })
  descripcion!: string;

  @IsNotEmpty({ message: 'El monto total del gasto es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El total debe ser un número válido.' })
  @Min(1, { message: 'El total del gasto debe ser mayor a 0.' })
  total!: number;

  @IsNotEmpty({ message: 'El tipo de gasto es obligatorio.' })
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El tipo de gasto no puede superar los 50 caracteres.' })
  tipo_gasto!: string; // ej: 'Insumos', 'Aseo', 'Servicios', 'Otros'

  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El medio de pago no puede superar los 50 caracteres.' })
  medio_pago?: string; // Por defecto 'Efectivo'

  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
