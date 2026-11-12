import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoPedido, TipoPedido } from '@prisma/client';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroOperacionDto extends FiltroFechasDto {
  @ApiPropertyOptional({
    description: 'Filtrar operaciones por tipo de servicio (salón o domicilio)',
    enum: TipoPedido,
    example: TipoPedido.salon,
  })
  @IsOptional()
  @IsEnum(TipoPedido, {
    message: `El tipo de servicio debe ser uno de: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo_servicio?: TipoPedido;

  @ApiPropertyOptional({
    description: 'Filtrar operaciones por estado del pedido',
    enum: EstadoPedido,
    example: EstadoPedido.cerrada,
  })
  @IsOptional()
  @IsEnum(EstadoPedido, {
    message: `El estado del pedido debe ser uno de: ${Object.values(EstadoPedido).join(', ')}.`,
  })
  estado?: EstadoPedido;
}
