import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryProductoDto {
  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'El parámetro disponible debe ser un valor booleano.' })
  disponible?: boolean;

  @IsOptional()
  @IsString()
  busqueda?: string;
}
