import { BadRequestException } from '@nestjs/common';

export interface FiltroRangoFecha {
  fecha?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface RangoFechaPrisma {
  gte?: Date;
  lte?: Date;
}

/**
 * Parsea una fecha 'YYYY-MM-DD' o ISO 8601 en zona horaria Colombia (UTC-5),
 * validando existencia real en calendario y devolviendo inicio o fin del día.
 */
function parsearFechaColombia(valor: string, esFin: boolean): Date {
  const trimmed = valor.trim();
  const matchSoloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (matchSoloFecha) {
    const anio = Number.parseInt(matchSoloFecha[1], 10);
    const mes = Number.parseInt(matchSoloFecha[2], 10);
    const dia = Number.parseInt(matchSoloFecha[3], 10);

    const checkUtc = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      checkUtc.getUTCFullYear() !== anio ||
      checkUtc.getUTCMonth() + 1 !== mes ||
      checkUtc.getUTCDate() !== dia
    ) {
      throw new BadRequestException(`La fecha '${trimmed}' no es una fecha calendario válida.`);
    }

    const sufijo = esFin ? 'T23:59:59.999-05:00' : 'T00:00:00.000-05:00';
    return new Date(`${trimmed}${sufijo}`);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const fecha = new Date(trimmed);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha;
    }
  }

  throw new BadRequestException(
    `El parámetro '${trimmed}' debe tener formato válido YYYY-MM-DD o ISO 8601.`,
  );
}

/**
 * Resuelve filtros opcionales por día único (`fecha`) o rango (`fecha_inicio`, `fecha_fin`)
 * para consultas Prisma `where.fecha_hora` / `where.fecha_cierre` en horario Colombia (-05:00).
 */
export function resolverRangoFechaOpcional(
  filtros?: FiltroRangoFecha,
): RangoFechaPrisma | undefined {
  const fechaUnica = filtros?.fecha?.trim();
  const fechaInicio = filtros?.fecha_inicio?.trim();
  const fechaFin = filtros?.fecha_fin?.trim();

  if (!fechaUnica && !fechaInicio && !fechaFin) {
    return undefined;
  }

  if (fechaInicio || fechaFin) {
    const gte = fechaInicio ? parsearFechaColombia(fechaInicio, false) : undefined;
    const lte = fechaFin ? parsearFechaColombia(fechaFin, true) : undefined;

    if (gte && lte && gte > lte) {
      throw new BadRequestException(
        'La fecha inicial (fecha_inicio) no puede ser posterior a la fecha final (fecha_fin).',
      );
    }

    return {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    };
  }

  return {
    gte: parsearFechaColombia(fechaUnica!, false),
    lte: parsearFechaColombia(fechaUnica!, true),
  };
}

