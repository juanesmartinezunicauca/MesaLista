import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class UpdatePedidoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @IsOptional()
  @IsInt()
  id_mesa?: number;

  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;
}
