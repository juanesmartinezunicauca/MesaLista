/**
 * Utilidad para exportar datos tabulares a formato CSV / Excel compatible con UTF-8.
 * Inserta automáticamente el BOM (Byte Order Mark) para que Microsoft Excel en Windows y Mac
 * interprete correctamente tildes, caracteres especiales y formato numérico.
 */
export function exportarACSV(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number | null | undefined)[][],
  tituloReporte?: string,
  periodo?: { inicio: string; fin: string }
): void {
  const lineas: string[] = [];

  if (tituloReporte) {
    lineas.push(`"${tituloReporte.replace(/"/g, '""')}"`);
    if (periodo) {
      lineas.push(`"Periodo consultado: ${periodo.inicio.substring(0, 10)} hasta ${periodo.fin.substring(0, 10)}"`);
    }
    lineas.push(`"Generado: ${new Date().toLocaleString('es-CO')}"`);
    lineas.push(''); // Línea en blanco
  }

  // Encabezados
  lineas.push(encabezados.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  // Filas de datos
  for (const fila of filas) {
    const filaFormateada = fila.map((val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    lineas.push(filaFormateada.join(','));
  }

  const csvContent = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fechaStr = new Date().toISOString().substring(0, 10);
  link.setAttribute('download', `${nombreArchivo}_${fechaStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
