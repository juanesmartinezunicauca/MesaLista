import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateItemPedidoDto {
  @ApiProperty({
    description: 'ID del producto de la carta a ordenar',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'El ID del producto es requerido.' })
  @IsInt({ message: 'El ID del producto debe ser un número entero.' })
  @Min(1, { message: 'El ID del producto debe ser mayor o igual a 1.' })
  @Type(() => Number)
  id_producto!: number;

  @ApiProperty({
    description: 'Cantidad de unidades solicitadas',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'La cantidad es requerida.' })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser al menos 1 unidad.' })
  @Type(() => Number)
  cantidad!: number;

  @ApiPropertyOptional({
    description: 'Ingredientes a retirar según personalización del cliente',
    example: 'Sin cebolla',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Los ingredientes removidos deben ser una cadena de texto.' })
  @MaxLength(255, { message: 'Los ingredientes removidos no pueden superar los 255 caracteres.' })
  ingredientes_removidos?: string;

  @ApiPropertyOptional({
    description: 'Instrucciones especiales para cocina (ej. término de cocción)',
    example: 'Bien tostada la masa',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
