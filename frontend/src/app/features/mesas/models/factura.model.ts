export type MetodoPagoTipo = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export interface PagoDetalle {
  metodo: MetodoPagoTipo;
  monto: number;
}

export interface FacturaCobroResult {
  cobrado: boolean;
  metodoPago: MetodoPagoTipo;
  pagos: PagoDetalle[];
  subtotal: number;
  propina: number;
  total: number;
  efectivoRecibido?: number;
  cambio?: number;
}

export interface ItemConsolidado {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  notas: string[];
}
