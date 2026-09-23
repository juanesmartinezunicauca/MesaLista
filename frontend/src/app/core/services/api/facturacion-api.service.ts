import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CreateFacturaPayload {
  id_mesa?: number;
  id_cliente?: number;
  propina?: number;
  observacion?: string;
  pagos: Array<{
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
   * Consulta una factura por ID
   */
  obtenerPorId(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }
}
