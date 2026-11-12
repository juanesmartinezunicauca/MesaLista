import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGastoDto {
  @ApiPropertyOptional({
    description: 'Modificación del concepto del gasto',
    example: 'Compra de hielo, limones y servilletas',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La descripción no puede superar los 255 caracteres.' })
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Monto ajustado del gasto (COP)',
    example: 18000.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El total debe ser un número válido.' })
  @Min(1, { message: 'El total del gasto debe ser mayor a 0.' })
  total?: number;

  @ApiPropertyOptional({
    description: 'Categoría del gasto',
    example: 'Insumos',
  })
  @IsOptional()
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El tipo de gasto no puede superar los 50 caracteres.' })
  tipo_gasto?: string;

  @ApiPropertyOptional({
    description: 'Medio de pago utilizado',
    example: 'Efectivo',
  })
  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El medio de pago no puede superar los 50 caracteres.' })
  medio_pago?: string;

  @ApiPropertyOptional({
    description: 'Comentarios adicionales',
    example: 'Soporte físico adjunto a caja',
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
