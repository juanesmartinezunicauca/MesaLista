import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class UpdatePedidoDto {
  @ApiPropertyOptional({
    description: 'Modificación de observaciones o notas',
    example: 'Cliente pidió cubiertos adicionales',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @ApiPropertyOptional({
    description: 'Reasignar mesa',
    example: 4,
  })
  @IsOptional()
  @IsInt()
  id_mesa?: number;

  @ApiPropertyOptional({
    description: 'Estado del pedido',
    enum: EstadoPedido,
  })
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;
}
