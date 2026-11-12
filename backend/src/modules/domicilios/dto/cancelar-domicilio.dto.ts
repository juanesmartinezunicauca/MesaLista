import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarDomicilioDto {
  @ApiPropertyOptional({
    description: 'Motivo formal de anulación del pedido a domicilio',
    example: 'Cliente solicitó cancelación telefónica antes del despacho',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'El motivo de cancelación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;
}
