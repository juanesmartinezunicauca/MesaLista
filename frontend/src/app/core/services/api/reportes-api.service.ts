import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PeriodoFechas {
  inicio: string;
  fin: string;
  inicio_anterior?: string;
  fin_anterior?: string;
}

export interface KpisDashboard {
  total_ventas: number;
  ventas_netas: number;
  total_propinas: number;
  cuentas_pagadas: number;
  ticket_promedio: number;
  total_gastos: number;
  balance_operativo: number;
  productos_bajo_stock: number;
  productos_agotados: number;
  cajas_con_diferencia: number;
  monto_diferencia_cajas: number;
  caja_activa_abierta: boolean;
  id_caja_activa: number | null;
}

export interface ComparativaDashboard {
  total_ventas_anterior: number;
  cuentas_pagadas_anterior: number;
  variacion_ventas_porcentaje: number | null;
  variacion_cuentas_porcentaje: number | null;
}

export interface SerieVentaDia {
  fecha: string;
  total_ventas: number;
  cuentas_pagadas: number;
}

export interface TopProducto {
  id_producto: number;
  nombre: string;
  categoria: string;
  unidades: number;
  total: number;
}

export interface DistribucionMedioPago {
  medio: string;
  total: number;
  porcentaje: number;
}

export interface DistribucionServicio {
  tipo: string;
  etiqueta: string;
  total: number;
  porcentaje: number;
}

export interface DashboardReporteResponse {
  periodo: PeriodoFechas;
  kpis: KpisDashboard;
  comparativa: ComparativaDashboard;
  graficas: {
    serie_ventas_por_dia: SerieVentaDia[];
    top_productos: TopProducto[];
    distribucion_medios_pago: DistribucionMedioPago[];
    distribucion_servicio: DistribucionServicio[];
  };
}

export interface FacturaDetalleReporte {
  id_venta: number;
  fecha_hora: string;
  cliente_nombre: string;
  tipo_servicio: 'salon' | 'domicilio';
  mesa_numero: number | null;
  subtotal: number;
  propina: number;
  total: number;
  medios_pago: string;
  atendido_por: string;
  observacion?: string;
}

export interface VentasReporteResponse {
  periodo: PeriodoFechas;
  resumen: {
    total_ventas: number;
    subtotal: number;
    total_propinas: number;
    cuentas_pagadas: number;
    ticket_promedio: number;
    total_salon: number;
    total_domicilio: number;
    porcentaje_salon: number;
    porcentaje_domicilio: number;
  };
  serie_temporal: SerieVentaDia[];
  categorias: {
    categoria: string;
    total: number;
    unidades: number;
    porcentaje: number;
  }[];
  ranking_productos: {
    id_producto: number;
    nombre: string;
    categoria: string;
    unidades: number;
    total: number;
    precio_promedio: number;
  }[];
  detalle_facturas: FacturaDetalleReporte[];
}

export interface TurnoCajaReporte {
  id_caja: number;
  estado: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  cajero_apertura: string;
  cajero_cierre: string | null;
  valor_inicial: number;
  total_ventas: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_transferencia: number;
  total_gastos: number;
  gastos_efectivo: number;
  valor_final_teorico: number;
  valor_final_fisico: number | null;
  diferencia: number | null;
  tipo_cuadre: 'exacto' | 'sobrante' | 'faltante' | 'en_progreso';
  observacion?: string;
}

export interface CajaMediosReporteResponse {
  periodo: PeriodoFechas;
  resumen: {
    total_recaudo: number;
    total_efectivo_esperado_neto: number;
    total_cajas_analizadas: number;
    total_cajas_cerradas: number;
    cajas_exactas: number;
    cajas_sobrantes: number;
    cajas_faltantes: number;
    suma_diferencias: number;
  };
  desglose_medios: {
    medio: string;
    recaudo: number;
    gastos: number;
    neto: number;
    porcentaje_ventas: number;
  }[];
  turnos: TurnoCajaReporte[];
}

export interface ProductoInventarioReporte {
  id_producto: number;
  nombre: string;
  categoria: string;
  controla_inventario: boolean;
  cantidad_inventario: number;
  disponible: boolean;
  costo_unitario: number;
  precio_venta: number;
  valor_inventario: number;
  estado_stock: 'agotado' | 'bajo' | 'normal' | 'no_controlado';
}

export interface InventarioReporteResponse {
  resumen: {
    total_productos: number;
    total_disponibles: number;
    total_controlan_stock: number;
    total_bajo_stock: number;
    total_agotados: number;
    valor_total_inventario: number;
    valor_potencial_venta: number;
  };
  productos: ProductoInventarioReporte[];
  ajustes_recientes: {
    id_ajuste: number;
    fecha_hora: string;
    producto: string;
    categoria: string;
    tipo_ajuste: string;
    cantidad: number;
    motivo: string;
    responsable: string;
  }[];
}

export interface GastoDetalleReporte {
  id_gasto: number;
  id_caja: number;
  fecha_hora: string;
  descripcion: string;
  tipo_gasto: string;
  medio_pago: string;
  total: number;
  responsable: string;
  observacion?: string;
}

export interface GastosReporteResponse {
  periodo: PeriodoFechas;
  resumen: {
    total_gastos: number;
    cantidad_movimientos: number;
    gasto_promedio: number;
  };
  desglose_por_tipo: {
    tipo: string;
    total: number;
    movimientos: number;
    porcentaje: number;
  }[];
  desglose_por_medio: {
    medio: string;
    total: number;
    movimientos: number;
    porcentaje: number;
  }[];
  detalle_gastos: GastoDetalleReporte[];
}

export interface ProductoRentabilidadReporte {
  id_producto: number;
  nombre: string;
  categoria: string;
  unidades_vendidas: number;
  ingresos_totales: number;
  costo_unitario_actual: number;
  costo_total_estimado: number;
  utilidad_bruta: number;
  margen_bruto_porcentaje: number;
}

export interface RentabilidadReporteResponse {
  periodo: PeriodoFechas;
  nota_metodologica: string;
  resumen: {
    total_ingresos: number;
    total_costos_estimados: number;
    utilidad_bruta_total: number;
    margen_bruto_promedio_porcentaje: number;
  };
  productos: ProductoRentabilidadReporte[];
}

export interface OperacionReporteResponse {
  periodo: PeriodoFechas;
  resumen: {
    total_pedidos: number;
    pedidos_enviados_activos: number;
    pedidos_cerrados: number;
    pedidos_cancelados: number;
    tasa_cancelacion_porcentaje: number;
    pedidos_salon: number;
    pedidos_domicilio: number;
  };
  distribucion_horaria: {
    hora: number;
    pedidos: number;
    etiqueta: string;
  }[];
  top_productos_cocina: {
    nombre: string;
    categoria: string;
    cantidad: number;
  }[];
  pedidos_cancelados_detalle: {
    id_pedido: number;
    numero_pedido: number;
    fecha_hora: string;
    tipo: string;
    mesa_numero: number | null;
    usuario: string;
    observacion: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class ReportesApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reportes`;

  private construirParams(filtros?: Record<string, any>): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return params;
  }

  obtenerDashboard(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Observable<DashboardReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<DashboardReporteResponse>(`${this.apiUrl}/dashboard`, { params });
  }

  obtenerVentas(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    categoria?: string;
    tipo_servicio?: string;
    id_mesa?: number;
  }): Observable<VentasReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<VentasReporteResponse>(`${this.apiUrl}/ventas`, { params });
  }

  obtenerCajaMedios(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Observable<CajaMediosReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<CajaMediosReporteResponse>(`${this.apiUrl}/caja-medios`, { params });
  }

  obtenerInventario(filtros?: {
    categoria?: string;
    solo_bajo_stock?: boolean;
    solo_agotados?: boolean;
    controla_inventario?: boolean;
    busqueda?: string;
  }): Observable<InventarioReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<InventarioReporteResponse>(`${this.apiUrl}/inventario`, { params });
  }

  obtenerGastos(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    tipo_gasto?: string;
    medio_pago?: string;
  }): Observable<GastosReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<GastosReporteResponse>(`${this.apiUrl}/gastos`, { params });
  }

  obtenerRentabilidad(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    categoria?: string;
  }): Observable<RentabilidadReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<RentabilidadReporteResponse>(`${this.apiUrl}/rentabilidad`, { params });
  }

  obtenerOperacion(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    tipo_servicio?: string;
    estado?: string;
  }): Observable<OperacionReporteResponse> {
    const params = this.construirParams(filtros);
    return this.http.get<OperacionReporteResponse>(`${this.apiUrl}/operacion`, { params });
  }
}
