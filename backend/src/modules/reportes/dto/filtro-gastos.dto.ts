import { IsOptional, IsString } from 'class-validator';
import { FiltroFechasDto } from './filtro-fechas.dto';

export class FiltroGastosDto extends FiltroFechasDto {
  @IsOptional()
  @IsString({ message: 'El tipo de gasto debe ser una cadena de texto.' })
  tipo_gasto?: string;

  @IsOptional()
  @IsString({ message: 'El medio de pago debe ser una cadena de texto.' })
  medio_pago?: string;
}
