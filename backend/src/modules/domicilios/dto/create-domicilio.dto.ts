import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateClienteDomicilioDto } from './create-cliente-domicilio.dto';
import { CreateItemPedidoDto } from '../../pedidos/dto/create-item-pedido.dto';

export class CreateDomicilioDto {
  @IsNotEmpty({ message: 'La información del cliente es obligatoria.' })
  @ValidateNested()
  @Type(() => CreateClienteDomicilioDto)
  cliente!: CreateClienteDomicilioDto;

  @IsArray({ message: 'Los items del pedido deben enviarse como una lista.' })
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemPedidoDto)
  items!: CreateItemPedidoDto[];

  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  observacion?: string;
}
