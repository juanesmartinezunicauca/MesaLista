import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoPedido } from '@prisma/client';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroVentasDto extends FiltroFechasDto {
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  categoria?: string;

  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El tipo de servicio debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo_servicio?: TipoPedido;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El ID de la mesa debe ser un entero.' })
  id_mesa?: number;
}
