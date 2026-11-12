import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProductoDto {
  @ApiPropertyOptional({
    description: 'Nombre del producto',
    example: 'Pizza Margarita Familiar (Especial)',
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres.' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Categoría en carta',
    example: 'Pizzas Especiales',
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'La categoría no puede exceder 50 caracteres.' })
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Precio de venta al público',
    example: 42000.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser un número válido.' })
  @Min(0, { message: 'El precio de venta no puede ser negativo.' })
  precio_venta?: number;

  @ApiPropertyOptional({
    description: 'Costo unitario de preparación',
    example: 19500.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo debe ser un número válido.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  costo?: number;

  @ApiPropertyOptional({
    description: 'Ingredientes personalizables',
    example: ['Cebolla', 'Tomate seco', 'Albahaca fresca'],
  })
  @IsOptional()
  ingredientes_removibles?: string | string[];

  @ApiPropertyOptional({
    description: 'Cantidad física en stock',
    example: 30,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad en inventario debe ser un número entero.' })
  @Min(0, { message: 'La cantidad en inventario no puede ser negativa.' })
  cantidad_inventario?: number;

  @ApiPropertyOptional({
    description: 'Control de inventario activo',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El control de inventario debe ser un valor booleano.' })
  controla_inventario?: boolean;

  @ApiPropertyOptional({
    description: 'Disponibilidad para comandar',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'La disponibilidad debe ser un valor booleano.' })
  disponible?: boolean;

  @ApiPropertyOptional({
    description: 'URL o base64 de la imagen',
    example: 'https://images.unsplash.com/photo-pizza2.jpg',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'La imagen debe ser una cadena de texto o null.' })
  imagen?: string | null;
}
