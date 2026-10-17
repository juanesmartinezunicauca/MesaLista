import { IsDateString, IsOptional } from 'class-validator';

export class FiltroFechasDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha inicial debe tener un formato válido (YYYY-MM-DD o ISO).' })
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha final debe tener un formato válido (YYYY-MM-DD o ISO).' })
  fecha_fin?: string;
}
