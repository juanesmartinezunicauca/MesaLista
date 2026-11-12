import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPedido, TipoPedido } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class QueryPedidoDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado del pedido',
    enum: EstadoPedido,
  })
  @IsOptional()
  @IsEnum(EstadoPedido, {
    message: `El filtro de estado debe ser uno de: ${Object.values(EstadoPedido).join(', ')}.`,
  })
  estado?: EstadoPedido;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de comanda (salón o domicilio)',
    enum: TipoPedido,
  })
  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El filtro de tipo debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo?: TipoPedido;

  @ApiPropertyOptional({
    description: 'Filtrar por número de mesa',
    example: 2,
  })
  @IsOptional()
  @IsInt({ message: 'El ID de la mesa debe ser un número entero.' })
  @Min(1)
  @Type(() => Number)
  id_mesa?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha calendario (YYYY-MM-DD)',
    example: '2026-11-10',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato ISO válido (YYYY-MM-DD).' })
  fecha?: string;
}
