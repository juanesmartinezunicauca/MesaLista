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
  @IsNotEmpty({ message: 'El tipo de pedido es requerido.' })
  @IsEnum(TipoPedido, {
    message: `El tipo de pedido debe ser uno de los siguientes: ${Object.values(TipoPedido).join(', ')}.`,
  })
  tipo!: TipoPedido;

  @IsOptional()
  @IsInt({ message: 'El ID de la mesa debe ser un número entero.' })
  @Min(1, { message: 'El ID de la mesa debe ser mayor o igual a 1.' })
  @Type(() => Number)
  id_mesa?: number;


  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @IsArray({ message: 'Los items del pedido deben enviarse como una lista.' })
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemPedidoDto)
  items!: CreateItemPedidoDto[];
}
