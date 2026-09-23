import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGastoDto {
  @IsNotEmpty({ message: 'La descripción del gasto es obligatoria.' })
  @IsString()
  descripcion!: string;

  @IsNotEmpty({ message: 'El monto total del gasto es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El total debe ser un número válido.' })
  @Min(1, { message: 'El total del gasto debe ser mayor a 0.' })
  total!: number;

  @IsNotEmpty({ message: 'El tipo de gasto es obligatorio.' })
  @IsString()
  tipo_gasto!: string; // ej: 'Insumos', 'Aseo', 'Servicios', 'Otros'

  @IsOptional()
  @IsString()
  medio_pago?: string; // Por defecto 'Efectivo'

  @IsOptional()
  @IsString()
  observacion?: string;
}
