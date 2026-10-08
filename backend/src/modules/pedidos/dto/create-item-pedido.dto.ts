import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateItemPedidoDto {
  @IsNotEmpty({ message: 'El ID del producto es requerido.' })
  @IsInt({ message: 'El ID del producto debe ser un número entero.' })
  @Min(1, { message: 'El ID del producto debe ser mayor o igual a 1.' })
  @Type(() => Number)
  id_producto!: number;

  @IsNotEmpty({ message: 'La cantidad es requerida.' })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser al menos 1 unidad.' })
  @Type(() => Number)
  cantidad!: number;

  @IsOptional()
  @IsString({ message: 'Los ingredientes removidos deben ser una cadena de texto.' })
  @MaxLength(255, { message: 'Los ingredientes removidos no pueden superar los 255 caracteres.' })
  ingredientes_removidos?: string;

  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
