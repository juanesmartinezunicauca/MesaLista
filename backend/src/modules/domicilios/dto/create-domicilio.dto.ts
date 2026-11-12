import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateClienteDomicilioDto } from './create-cliente-domicilio.dto';
import { CreateItemPedidoDto } from '../../pedidos/dto/create-item-pedido.dto';

export class CreateDomicilioDto {
  @ApiProperty({
    description: 'Información del destinatario y punto de entrega',
    type: CreateClienteDomicilioDto,
  })
  @IsNotEmpty({ message: 'La información del cliente es obligatoria.' })
  @ValidateNested()
  @Type(() => CreateClienteDomicilioDto)
  cliente!: CreateClienteDomicilioDto;

  @ApiProperty({
    description: 'Lista de ítems gastronómicos ordenados para domicilio',
    type: [CreateItemPedidoDto],
  })
  @IsArray({ message: 'Los items del pedido deben enviarse como una lista.' })
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemPedidoDto)
  items!: CreateItemPedidoDto[];

  @ApiPropertyOptional({
    description: 'Notas adicionales para el repartidor o restaurante',
    example: 'Por favor llevar cambio para billete de $50.000',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @ApiPropertyOptional({
    description: 'Método acordado para el cobro (Efectivo, Nequi, Datáfono)',
    example: 'Efectivo',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'El método de pago debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El método de pago no puede superar los 50 caracteres.' })
  metodo_pago?: string;

  @ApiPropertyOptional({
    description: 'Tarifa del servicio de transporte/domicilio',
    example: 5000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El costo de envío debe ser un valor numérico.' })
  @Min(0, { message: 'El costo de envío no puede ser negativo.' })
  costo_envio?: number;

  @ApiPropertyOptional({
    description: 'Sector o zona geográfica del domicilio',
    example: 'Norte / Campamento',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'La zona de entrega debe ser un texto.' })
  @MaxLength(100, { message: 'La zona de entrega no puede superar los 100 caracteres.' })
  zona_entrega?: string;
}
