import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface FiltroHistorialCaja {
  limite?: number;
  fecha?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface ResumenCajaTurno {
  valor_base: number;
  total_ventas: number;
  ventas_netas?: number;
  total_propinas: number;
  total_transacciones: number;
  total_facturas_anuladas?: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_transferencia: number;
  total_gastos: number;
  gastos_efectivo: number;
  desglose_gastos: Record<string, number>;
  total_movimientos_gasto: number;
  efectivo_esperado: number;
  costo_insumos?: number;
  utilidad_del_dia: number;
  utilidad_neta?: number;
  margen_utilidad_porcentaje?: number;
}

export interface MovimientoCaja {
  id: string;
  hora: string;
  descripcion: string;
  tipo: 'Ingreso' | 'Gasto' | 'Anulada';
  monto: number;
  medio_pago: string;
  responsable: string;
}

export interface EstadoCajaResponse {
  abierta: boolean;
  caja: {
    id_caja: number;
    fecha_apertura: string;
    valor_inicial: number;
    usuario_apertura: string;
  } | null;
  resumen: ResumenCajaTurno | null;
  movimientos: MovimientoCaja[];
}

export interface CierreCajaResult {
  exito: boolean;
  caja_id: number;
  fecha_apertura: string;
  fecha_cierre: string;
  valor_inicial: number;
  total_ventas: number;
  total_gastos: number;
  utilidad_del_dia?: number;
  utilidad_neta?: number;
  valor_final_teorico: number;
  valor_final_fisico: number;
  diferencia: number;
  tipo_cuadre: 'exacto' | 'sobrante' | 'faltante';
  cajero_cierre: string;
}

@Injectable({
  providedIn: 'root',
})
export class CajaApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/caja`;

  /**
   * Abre un nuevo turno de caja con base inicial
   */
  abrirCaja(valor_inicial: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/abrir`, { valor_inicial });
  }

  /**
   * Actualiza el valor base de apertura de la caja activa
   */
  actualizarBase(valor_inicial: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/base`, { valor_inicial });
  }

  /**
   * Obtiene el estado actual de la caja, métricas del turno y movimientos
   */
  obtenerEstado(): Observable<EstadoCajaResponse> {
    return this.http.get<EstadoCajaResponse>(`${this.apiUrl}/estado`);
  }

  /**
   * Registra una salida menor de dinero (gasto)
   */
  registrarGasto(gasto: {
    descripcion: string;
    total: number;
    tipo_gasto: string;
    medio_pago?: string;
    observacion?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/gastos`, gasto);
  }

  /**
   * Realiza el arqueo físico y cierra la caja
   */
  cerrarCaja(cierre: {
    valor_final_fisico: number;
    valor_transferencias_reportado?: number;
    observacion?: string;
  }): Observable<CierreCajaResult> {
    return this.http.post<CierreCajaResult>(`${this.apiUrl}/cerrar`, cierre);
  }

  private buildHistorialParams(filtro: number | FiltroHistorialCaja, defaultLimit: number): HttpParams {
    let params = new HttpParams();
    if (typeof filtro === 'number') {
      return params.set('limite', filtro.toString());
    }
    if (filtro.limite) {
      params = params.set('limite', filtro.limite.toString());
    } else if (!filtro.fecha && !filtro.fecha_inicio && !filtro.fecha_fin) {
      params = params.set('limite', defaultLimit.toString());
    }
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    if (filtro.fecha_inicio) params = params.set('fecha_inicio', filtro.fecha_inicio);
    if (filtro.fecha_fin) params = params.set('fecha_fin', filtro.fecha_fin);
    return params;
  }

  /**
   * Consulta el histórico de turnos anteriores
   */
  obtenerHistorial(filtro: number | FiltroHistorialCaja = 15): Observable<any[]> {
    const params = this.buildHistorialParams(filtro, 15);
    return this.http.get<any[]>(`${this.apiUrl}/historial`, { params });
  }

  /**
   * Reinicia parcialmente los datos operativos (cajas, pedidos, facturas, gastos)
   * preservando íntegramente catálogo y usuarios. Exclusivo para administradores.
   */
  resetOperacional(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-operacional`, {});
  }

  /**
   * Actualiza la observación de un turno cerrado de caja (super admin)
   */
  actualizarObservacionTurno(id_caja: number, observacion: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/historial/${id_caja}`, { observacion });
  }

  /**
   * Consulta el histórico de gastos
   */
  obtenerGastos(filtro: number | FiltroHistorialCaja = 50): Observable<any[]> {
    const params = this.buildHistorialParams(filtro, 50);
    return this.http.get<any[]>(`${this.apiUrl}/gastos`, { params });
  }

  /**
   * Actualiza un gasto existente
   */
  actualizarGasto(id: number, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/gastos/${id}`, payload);
  }

  /**
   * Elimina un gasto del sistema (exclusivo para super administrador)
   */
  eliminarGasto(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/gastos/${id}`);
  }
}


