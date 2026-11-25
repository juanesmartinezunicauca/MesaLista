/**
 * Utilidades contables y de seguridad compartidas entre Caja, Facturación, Reportes y Bootstrap.
 */

/**
 * Normaliza y categoriza un medio de pago para mantener consistencia contable exacta
 * entre CajaService, FacturacionService y ReportesService.
 */
export function normalizarMedioPago(
  nombre?: string | null,
): 'efectivo' | 'tarjeta' | 'transferencia' {
  const norm = (nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (norm.includes('efectivo')) return 'efectivo';

  if (
    norm.includes('tarjeta') ||
    norm.includes('datafono') ||
    norm.includes('debito') ||
    norm.includes('credito') ||
    /\bpos\b/.test(norm)
  ) {
    return 'tarjeta';
  }

  if (
    norm.includes('transferencia') ||
    norm.includes('transf') ||
    norm.includes('nequi') ||
    norm.includes('daviplata') ||
    norm.includes('bancolombia') ||
    /\bpse\b/.test(norm) ||
    /\bqr\b/.test(norm)
  ) {
    return 'transferencia';
  }

  return 'efectivo';
}

/**
 * Redondea montos monetarios a 2 decimales evitando artefactos IEEE 754.
 */
export function redondearMoneda(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Valida orígenes CORS estrictamente por hostname (previene bypass como localhost.atacante.com
 * o apps de terceros alojadas en *.vercel.app).
 */
export function esOrigenCorsPermitido(
  origin: string | undefined,
  configuredOrigins: string[] = [],
): boolean {
  if (!origin) return true;

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }
    if (
      parsed.protocol === 'https:' &&
      (host === 'mesa-lista.vercel.app' || /^mesa-lista-[a-z0-9-]+\.vercel\.app$/.test(host))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
