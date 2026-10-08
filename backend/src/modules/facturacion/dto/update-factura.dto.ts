import { IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PagoItemDto } from './create-factura.dto';

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
}
