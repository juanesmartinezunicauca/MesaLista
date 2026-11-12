import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PagoItemDto } from './create-factura.dto';

export class UpdateFacturaItemDto {
  @ApiPropertyOptional({ description: 'ID del ítem en pedido si ya existe', example: 101 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_item?: number;

  @ApiPropertyOptional({ description: 'ID del producto gastronómico', example: 1 })
  @IsNotEmpty({ message: 'El id_producto es obligatorio para cada ítem.' })
  @Type(() => Number)
  @IsNumber()
  id_producto!: number;

  @ApiPropertyOptional({ description: 'Cantidad facturada', example: 2, minimum: 1 })
  @IsNotEmpty({ message: 'La cantidad debe ser mayor o igual a 1.' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidad!: number;

  @ApiPropertyOptional({ description: 'Precio unitario congelado', example: 38000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_unitario?: number;

  @ApiPropertyOptional({ description: 'Observación del ítem' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;
}

export class UpdateFacturaDto {
  @ApiPropertyOptional({ description: 'Ajuste de propina (COP)', example: 5000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  propina?: number;

  @ApiPropertyOptional({ description: 'Observación modificada', example: 'Corrección de propina autorizada' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @ApiPropertyOptional({ description: 'Motivo formal de la edición para auditoría interna', example: 'Corrección de medio de pago' })
  @IsOptional()
  @IsString({ message: 'El motivo de edición debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo de edición no puede superar los 255 caracteres.' })
  motivo_edicion?: string;

  @ApiPropertyOptional({ description: 'Pagos corregidos o redistribuidos', type: [PagoItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos?: PagoItemDto[];

  @ApiPropertyOptional({ description: 'Ítems modificados', type: [UpdateFacturaItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFacturaItemDto)
  items?: UpdateFacturaItemDto[];
}
