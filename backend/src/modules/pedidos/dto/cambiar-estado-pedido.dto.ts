import { EstadoPedido } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class CambiarEstadoPedidoDto {
  @IsNotEmpty({ message: 'El estado del pedido es requerido.' })
  @IsEnum(EstadoPedido, {
    message: `El estado debe ser uno de los siguientes: ${Object.values(EstadoPedido).join(', ')}.`,
  })
  estado!: EstadoPedido;
}
