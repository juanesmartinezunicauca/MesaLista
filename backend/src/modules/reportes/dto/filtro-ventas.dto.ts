import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoPedido } from '@prisma/client';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroVentasDto extends FiltroFechasDto {
  @ApiPropertyOptional({
    description: 'Filtrar ventas por categoría de producto',
    example: 'Pizzas',
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por canal de atención',
    enum: TipoPedido,
    example: TipoPedido.salon,
  })
  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El tipo de servicio debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo_servicio?: TipoPedido;

  @ApiPropertyOptional({
    description: 'Filtrar por número de mesa del salón',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El ID de la mesa debe ser un entero.' })
  id_mesa?: number;
}
