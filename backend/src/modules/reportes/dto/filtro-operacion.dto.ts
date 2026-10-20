import { IsEnum, IsOptional } from 'class-validator';
import { EstadoPedido, TipoPedido } from '@prisma/client';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroOperacionDto extends FiltroFechasDto {
  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El tipo de servicio debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo_servicio?: TipoPedido;

  @IsOptional()
  @IsEnum(EstadoPedido, {
    message: `El estado del pedido debe ser uno de: ${Object.values(EstadoPedido).join(', ')}.`,
  })
  estado?: EstadoPedido;
}
