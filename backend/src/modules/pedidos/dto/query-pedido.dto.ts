import { EstadoPedido, TipoPedido } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class QueryPedidoDto {
  @IsOptional()
  @IsEnum(EstadoPedido, {
    message: `El filtro de estado debe ser uno de: ${Object.values(EstadoPedido).join(', ')}.`,
  })
  estado?: EstadoPedido;

  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El filtro de tipo debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo?: TipoPedido;

  @IsOptional()
  @IsInt({ message: 'El ID de la mesa debe ser un número entero.' })
  @Min(1)
  @Type(() => Number)
  id_mesa?: number;

  @IsOptional()
  @IsInt({ message: 'El ID del cliente debe ser un número entero.' })
  @Min(1)
  @Type(() => Number)
  id_cliente?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato ISO válido (YYYY-MM-DD).' })
  fecha?: string;
}
