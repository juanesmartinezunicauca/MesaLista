// core/utils/export-excel.util.ts
import * as XLSX from 'xlsx';

/**
 * Export data to an Excel workbook (XLSX).
 * Supports optional embedding of chart images (as base64 PNG data URLs) into a dedicated sheet.
 */
export function exportarAExcel(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number | null | undefined)[][],
  tituloReporte?: string,
  periodo?: { inicio: string; fin: string },
  chartImages?: { name: string; dataUrl: string }[]
): void {
  // Build worksheet data
  const wsData: any[][] = [];
  if (tituloReporte) {
    wsData.push([tituloReporte]);
    if (periodo) {
      wsData.push([`Periodo: ${periodo.inicio} - ${periodo.fin}`]);
    }
    wsData.push([]); // blank line
  }
  wsData.push(encabezados);
  wsData.push(...filas);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');

  // Optional chart images sheet
  if (chartImages && chartImages.length) {
    const wsChart = XLSX.utils.aoa_to_sheet([
      ['Gráficos (copiar y pegar como imagen en Excel)'],
    ]);
    chartImages.forEach((img, idx) => {
      const cell = `A${idx + 3}`; // start after header
      wsChart[cell] = { t: 's', v: img.dataUrl };
    });
    XLSX.utils.book_append_sheet(wb, wsChart, 'Gráficos');
  }

  const fechaStr = new Date().toISOString().substring(0, 10);
  const fileName = `${nombreArchivo}_${fechaStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
