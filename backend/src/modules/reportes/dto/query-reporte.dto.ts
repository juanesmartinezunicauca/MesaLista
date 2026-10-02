import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum PeriodoReporte {
  HOY = 'hoy',
  SEMANA = 'semana',
  MES = 'mes',
  PERSONALIZADO = 'personalizado',
}

export class QueryReporteDto {
  @IsOptional()
  @IsEnum(PeriodoReporte, {
    message: 'El periodo debe ser: hoy, semana, mes o personalizado.',
  })
  periodo?: PeriodoReporte = PeriodoReporte.HOY;

  @IsOptional()
  @IsDateString({}, { message: 'fecha_inicio debe ser una fecha ISO válida (YYYY-MM-DD).' })
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fecha_fin debe ser una fecha ISO válida (YYYY-MM-DD).' })
  fecha_fin?: string;
}
