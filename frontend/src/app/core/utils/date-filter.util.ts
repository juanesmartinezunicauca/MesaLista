export type PeriodoPreset =
  | 'todos'
  | 'hoy'
  | 'ayer'
  | '7dias'
  | 'mes'
  | 'mes_anterior'
  | 'personalizado';

/**
 * Formatea una fecha local en formato YYYY-MM-DD sin desplazamiento UTC.
 */
export function formatearFechaLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula fechaInicio y fechaFin en formato YYYY-MM-DD para presets comunes de historiales y reportes.
 */
export function resolverPresetRango(
  preset: Exclude<PeriodoPreset, 'personalizado'>,
  referencia: Date = new Date(),
): { fechaInicio: string; fechaFin: string } {
  if (preset === 'todos') {
    return { fechaInicio: '', fechaFin: '' };
  }

  if (preset === 'hoy') {
    const hoy = formatearFechaLocal(referencia);
    return { fechaInicio: hoy, fechaFin: hoy };
  }

  if (preset === 'ayer') {
    const ayer = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      referencia.getDate() - 1,
    );
    const ayerStr = formatearFechaLocal(ayer);
    return { fechaInicio: ayerStr, fechaFin: ayerStr };
  }

  if (preset === '7dias') {
    const inicio = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      referencia.getDate() - 6,
    );
    return {
      fechaInicio: formatearFechaLocal(inicio),
      fechaFin: formatearFechaLocal(referencia),
    };
  }

  if (preset === 'mes_anterior') {
    const inicio = new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1);
    const fin = new Date(referencia.getFullYear(), referencia.getMonth(), 0);
    return {
      fechaInicio: formatearFechaLocal(inicio),
      fechaFin: formatearFechaLocal(fin),
    };
  }

  const inicioMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  return {
    fechaInicio: formatearFechaLocal(inicioMes),
    fechaFin: formatearFechaLocal(referencia),
  };
}

