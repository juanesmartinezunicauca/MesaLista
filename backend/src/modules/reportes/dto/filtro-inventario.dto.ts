import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FiltroInventarioDto {
  @ApiPropertyOptional({
    description: 'Filtrar existencias por categoría',
    example: 'Pizzas',
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Filtrar únicamente productos con existencias por debajo del umbral de alerta',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'solo_bajo_stock debe ser un valor booleano.' })
  solo_bajo_stock?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar únicamente productos totalmente agotados (stock 0)',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'solo_agotados debe ser un valor booleano.' })
  solo_agotados?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar si el producto controla inventario',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'controla_inventario debe ser un valor booleano.' })
  controla_inventario?: boolean;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre de producto',
    example: 'Margarita',
  })
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto.' })
  busqueda?: string;
}
