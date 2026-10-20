import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FiltroInventarioDto {
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto.' })
  categoria?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'solo_bajo_stock debe ser un valor booleano.' })
  solo_bajo_stock?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'solo_agotados debe ser un valor booleano.' })
  solo_agotados?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'controla_inventario debe ser un valor booleano.' })
  controla_inventario?: boolean;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto.' })
  busqueda?: string;
}
