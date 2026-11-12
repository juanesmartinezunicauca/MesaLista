import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class FiltroFechasDto {
  @ApiPropertyOptional({
    description: 'Fecha inicial del periodo de análisis (YYYY-MM-DD)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha inicial debe tener un formato válido (YYYY-MM-DD o ISO).' })
  fecha_inicio?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del periodo de análisis (YYYY-MM-DD)',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha final debe tener un formato válido (YYYY-MM-DD o ISO).' })
  fecha_fin?: string;
}
