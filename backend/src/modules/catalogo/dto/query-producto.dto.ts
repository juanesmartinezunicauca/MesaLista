import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryProductoDto {
  @ApiPropertyOptional({
    description: 'Filtrar por categoría (ej. Pizzas, Bebidas, Pastas)',
    example: 'Pizzas',
  })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por disponibilidad en cocina',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'El parámetro disponible debe ser un valor booleano.' })
  disponible?: boolean;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre o descripción',
    example: 'Margarita',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;
}
