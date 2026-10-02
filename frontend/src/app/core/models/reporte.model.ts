// ============================================================================
// MesaLista - Modelos para Reportes, Analítica y Métricas Ejecutivas
// ============================================================================

export type PeriodoReporteTipo = 'hoy' | 'semana' | 'mes' | 'personalizado';

export interface FiltroReporte {
  periodo: PeriodoReporteTipo;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface KpisReporte {
  ingresos_totales: number;
  subtotal_ventas: number;
  total_propinas: number;
  total_gastos: number;
  utilidad_neta: number;
  costo_mercancia_vendida: number;
  margen_bruto: number;
  porcentaje_margen: number;
  total_facturas: number;
  total_pedidos: number;
  ticket_promedio: number;
}

export interface DesgloseCanalItem {
  facturas: number;
  total: number;
  porcentaje: number;
}

export interface CanalesReporte {
  salon: DesgloseCanalItem;
  domicilio: DesgloseCanalItem;
}

export interface DesgloseMedioPago {
  nombre: string;
  monto: number;
  transacciones: number;
  porcentaje: number;
}

export interface TopProductoReporte {
  id_producto: number;
  nombre: string;
  categoria: string;
  cantidad_vendida: number;
  total_recaudado: number;
  costo_total: number;
  margen_estimado: number;
}

export interface DesgloseGastoReporte {
  categoria: string;
  total: number;
  movimientos: number;
  porcentaje: number;
}

export interface PuntoSerieTemporal {
  fecha: string;
  label: string;
  ingresos: number;
  gastos: number;
  pedidos: number;
}

export interface ResumenReporte {
  periodo: PeriodoReporteTipo;
  etiqueta: string;
  rango: {
    inicio: string;
    fin: string;
  };
  kpis: KpisReporte;
  canales: CanalesReporte;
  medios_pago: DesgloseMedioPago[];
  top_productos: TopProductoReporte[];
  desglose_gastos: DesgloseGastoReporte[];
  serie_temporal: PuntoSerieTemporal[];
}

export interface TurnoCajaReporte {
  id_caja: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  estado: 'abierta' | 'cerrada';
  valor_inicial: number;
  valor_final_teorico: number | null;
  valor_final_fisico: number | null;
  diferencia: number | null;
  usuario_apertura: string;
  usuario_cierre: string | null;
  total_facturas: number;
  total_gastos: number;
}
