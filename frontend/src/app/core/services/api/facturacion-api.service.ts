import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CreateFacturaPayload {
  id_mesa?: number;
  id_pedido?: number;
  id_cliente?: number;
  propina?: number;
  observacion?: string;
  cerrar_pedido?: boolean;
  pagos: Array<{
    medio_pago: string;
    monto: number;
  }>;
}

export interface UpdateFacturaPayload {
  propina?: number;
  observacion?: string;
  pagos?: Array<{
    medio_pago: string;
    monto: number;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class FacturacionApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/facturas`;

  /**
   * Genera la factura de cobro y asocia el pago a la caja abierta
   */
  crearFactura(payload: CreateFacturaPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  /**
   * Consulta el historial de facturas
   */
  obtenerTodas(filtros?: {
    tipo?: string;
    fecha?: string;
    buscar?: string;
    id_caja?: number;
  }): Observable<any[]> {
    let params = new HttpParams();
    if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros?.fecha) params = params.set('fecha', filtros.fecha);
    if (filtros?.buscar) params = params.set('buscar', filtros.buscar);
    if (filtros?.id_caja) params = params.set('id_caja', filtros.id_caja.toString());
    return this.http.get<any[]>(this.apiUrl, { params });
  }

  /**
   * Consulta una factura por ID
   */
  obtenerPorId(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Modifica una facturación existente (desglose de pagos, método de pago, propina u observación).
   */
  actualizarFactura(id: number, payload: UpdateFacturaPayload): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, payload);
  }

  /**
   * Elimina / anula una factura registrada y ajusta el saldo de caja
   */
  eliminarFactura(id: number): Observable<{ exito: boolean; mensaje: string }> {
    return this.http.delete<{ exito: boolean; mensaje: string }>(`${this.apiUrl}/${id}`);
  }
}

