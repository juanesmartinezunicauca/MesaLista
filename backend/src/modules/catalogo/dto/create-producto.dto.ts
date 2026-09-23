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
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre del producto es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres.' })
  nombre!: string;

  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La categoría del producto es obligatoria.' })
  @MaxLength(50, { message: 'La categoría no puede exceder 50 caracteres.' })
  categoria!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser un número válido.' })
  @Min(0, { message: 'El precio de venta no puede ser negativo.' })
  precio_venta!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo debe ser un número válido.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  costo!: number;

  @IsOptional()
  ingredientes_removibles?: string | string[];

  @IsOptional()
  @IsInt({ message: 'La cantidad en inventario debe ser un número entero.' })
  @Min(0, { message: 'La cantidad en inventario no puede ser negativa.' })
  cantidad_inventario?: number;

  @IsOptional()
  @IsBoolean({ message: 'El control de inventario debe ser un valor booleano.' })
  controla_inventario?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La disponibilidad debe ser un valor booleano.' })
  disponible?: boolean;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una cadena de texto válida.' })
  imagen?: string;
}
