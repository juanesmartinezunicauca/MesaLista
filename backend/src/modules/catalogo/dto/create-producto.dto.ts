import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @ApiProperty({
    description: 'Nombre del producto gastronómico',
    example: 'Pizza Margarita Familiar',
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre del producto es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres.' })
  nombre!: string;

  @ApiProperty({
    description: 'Categoría de la carta',
    example: 'Pizzas',
    maxLength: 50,
  })
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La categoría del producto es obligatoria.' })
  @MaxLength(50, { message: 'La categoría no puede exceder 50 caracteres.' })
  categoria!: string;

  @ApiProperty({
    description: 'Precio de venta al público (COP)',
    example: 38000.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser un número válido.' })
  @Min(0, { message: 'El precio de venta no puede ser negativo.' })
  precio_venta!: number;

  @ApiProperty({
    description: 'Costo de producción o insumos (COP)',
    example: 18000.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo debe ser un número válido.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  costo!: number;

  @ApiPropertyOptional({
    description: 'Ingredientes personalizables o removibles (array o string separado por comas)',
    example: ['Cebolla', 'Champiñones', 'Orégano'],
  })
  @IsOptional()
  ingredientes_removibles?: string | string[];

  @ApiPropertyOptional({
    description: 'Cantidad física en existencias',
    example: 25,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad en inventario debe ser un número entero.' })
  @Min(0, { message: 'La cantidad en inventario no puede ser negativa.' })
  cantidad_inventario?: number;

  @ApiPropertyOptional({
    description: 'Indica si el sistema debe descontar existencias automáticamente',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El control de inventario debe ser un valor booleano.' })
  controla_inventario?: boolean;

  @ApiPropertyOptional({
    description: 'Disponibilidad inmediata en cocina y carta digital',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'La disponibilidad debe ser un valor booleano.' })
  disponible?: boolean;

  @ApiPropertyOptional({
    description: 'URL o Data URI (base64) de la fotografía del plato',
    example: 'https://images.unsplash.com/photo-pizza.jpg',
  })
  @IsOptional()
  @IsString({ message: 'La imagen debe ser una cadena de texto válida.' })
  imagen?: string;
}
