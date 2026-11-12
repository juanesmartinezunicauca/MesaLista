import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGastoDto {
  @ApiProperty({
    description: 'Concepto o detalle del gasto menor de caja',
    example: 'Compra de bolsas de hielo y limones de emergencia',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'La descripción del gasto es obligatoria.' })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La descripción no puede superar los 255 caracteres.' })
  descripcion!: string;

  @ApiProperty({
    description: 'Valor monetario del egreso (COP)',
    example: 15000.0,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'El monto total del gasto es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El total debe ser un número válido.' })
  @Min(1, { message: 'El total del gasto debe ser mayor a 0.' })
  total!: number;

  @ApiProperty({
    description: 'Categoría o tipo de gasto (Insumos, Aseo, Servicios, Proveedores, Otros)',
    example: 'Insumos',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'El tipo de gasto es obligatorio.' })
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El tipo de gasto no puede superar los 50 caracteres.' })
  tipo_gasto!: string;

  @ApiPropertyOptional({
    description: 'Medio de pago con el que salió el dinero (Efectivo por defecto)',
    example: 'Efectivo',
    default: 'Efectivo',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El medio de pago no puede superar los 50 caracteres.' })
  medio_pago?: string;

  @ApiPropertyOptional({
    description: 'Comprobante o soporte de factura del gasto',
    example: 'Factura tienda Don Pedro #451',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
