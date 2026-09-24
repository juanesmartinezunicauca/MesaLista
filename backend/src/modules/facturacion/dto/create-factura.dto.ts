import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PagoItemDto {
  @IsNotEmpty({ message: 'El medio de pago es obligatorio.' })
  @IsString()
  medio_pago!: string; // 'Efectivo', 'Tarjeta', 'Transferencia'

  @IsNotEmpty({ message: 'El monto del pago es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido.' })
  @Min(0, { message: 'El monto no puede ser negativo.' })
  monto!: number;
}

export class CreateFacturaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_mesa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_cliente?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  propina?: number;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsNotEmpty({ message: 'Debe especificar al menos un pago.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos!: PagoItemDto[];
}
