import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPedido } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateItemPedidoDto } from './create-item-pedido.dto';

export class CreatePedidoDto {
  @ApiProperty({
    description: 'Canal o tipo de servicio',
    enum: TipoPedido,
    example: TipoPedido.salon,
  })
  @IsNotEmpty({ message: 'El tipo de pedido es requerido.' })
  @IsEnum(TipoPedido, {
    message: `El tipo de pedido debe ser uno de los siguientes: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo!: TipoPedido;

  @ApiPropertyOptional({
    description: 'ID de la mesa del salón (requerido si tipo es salón)',
    example: 3,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'El ID de la mesa debe ser un número entero.' })
  @Min(1, { message: 'El ID de la mesa debe ser mayor o igual a 1.' })
  @Type(() => Number)
  id_mesa?: number;

  @ApiPropertyOptional({
    description: 'Comentarios generales para el despacho de la comanda',
    example: 'Mesa con niños, servir bebidas primero',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @ApiProperty({
    description: 'Lista de ítems y platos incluidos en la orden',
    type: [CreateItemPedidoDto],
  })
  @IsArray({ message: 'Los items del pedido deben enviarse como una lista.' })
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemPedidoDto)
  items!: CreateItemPedidoDto[];
}
