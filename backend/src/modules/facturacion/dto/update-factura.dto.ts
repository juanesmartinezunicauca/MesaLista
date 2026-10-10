import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PagoItemDto } from './create-factura.dto';

export class UpdateFacturaItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_item?: number;

  @IsNotEmpty({ message: 'El id_producto es obligatorio para cada ítem.' })
  @Type(() => Number)
  @IsNumber()
  id_producto!: number;

  @IsNotEmpty({ message: 'La cantidad debe ser mayor o igual a 1.' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidad!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_unitario?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;
}

export class UpdateFacturaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  propina?: number;

  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos?: PagoItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFacturaItemDto)
  items?: UpdateFacturaItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo_edicion?: string;
}
