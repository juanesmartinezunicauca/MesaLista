// core/utils/export-pdf.util.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to a PDF document.
 * Includes optional chart images (as base64 PNG data URLs) placed above the table.
 */
export function exportarAPDF(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number | null | undefined)[][],
  tituloReporte?: string,
  periodo?: { inicio: string; fin: string },
  chartImages?: { name: string; dataUrl: string }[]
): void {
  const doc = new jsPDF();
  let y = 10;

  if (tituloReporte) {
    doc.setFontSize(16);
    doc.text(tituloReporte, 10, y);
    y += 8;
  }
  if (periodo) {
    doc.setFontSize(10);
    doc.text(`Periodo: ${periodo.inicio} - ${periodo.fin}`, 10, y);
    y += 6;
  }

  // Add chart images if any (stacked vertically)
  if (chartImages && chartImages.length) {
    chartImages.forEach((img) => {
      // assume img.dataUrl is a base64 PNG data URL
      const imgProps = doc.getImageProperties(img.dataUrl);
      const pdfWidth = doc.internal.pageSize.getWidth() - 20;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      doc.addImage(img.dataUrl, 'PNG', 10, y, pdfWidth, pdfHeight);
      y += pdfHeight + 4;
    });
  }

  // Add table using autoTable
  autoTable(doc, {
    startY: y,
    head: [encabezados],
    body: filas.map((row) => row.map((v) => (v === null || v === undefined ? '' : v))),
    styles: { fontSize: 9 },
    theme: 'grid',
  });

  const fechaStr = new Date().toISOString().substring(0, 10);
  const fileName = `${nombreArchivo}_${fechaStr}.pdf`;
  doc.save(fileName);
}
