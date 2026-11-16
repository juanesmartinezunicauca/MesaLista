import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroRentabilidadDto extends FiltroFechasDto {
  @ApiPropertyOptional({
    description: 'Filtrar análisis de rentabilidad por categoría de plato',
    example: 'Pizzas',
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  categoria?: string;
}
