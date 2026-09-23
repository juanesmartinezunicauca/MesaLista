import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ResumenCajaTurno {
  valor_base: number;
  total_ventas: number;
  total_propinas: number;
  total_transacciones: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_transferencia: number;
  total_gastos: number;
  gastos_efectivo: number;
  desglose_gastos: Record<string, number>;
  total_movimientos_gasto: number;
  efectivo_esperado: number;
}

export interface MovimientoCaja {
  id: string;
  hora: string;
  descripcion: string;
  tipo: 'Ingreso' | 'Gasto';
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
    observacion?: string;
  }): Observable<CierreCajaResult> {
    return this.http.post<CierreCajaResult>(`${this.apiUrl}/cerrar`, cierre);
  }

  /**
   * Consulta el histórico de turnos anteriores
   */
  obtenerHistorial(limite = 15): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/historial?limite=${limite}`);
  }
}
