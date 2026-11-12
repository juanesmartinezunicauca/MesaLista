import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroGastosDto extends FiltroFechasDto {
  @ApiPropertyOptional({
    description: 'Filtrar egresos por categoría de gasto (Insumos, Aseo, Servicios, Otros)',
    example: 'Insumos',
  })
  @IsOptional()
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  tipo_gasto?: string;

  @ApiPropertyOptional({
    description: 'Filtrar egresos por medio de pago',
    example: 'Efectivo',
  })
  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  medio_pago?: string;
}
