import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CreateItemPedidoPayload {
  id_producto: number;
  cantidad: number;
  ingredientes_removidos?: string;
  observacion?: string;
}

export interface CreatePedidoPayload {
  tipo: 'salon' | 'domicilio';
  id_mesa?: number;
  id_cliente?: number;
  observacion?: string;
  items: CreateItemPedidoPayload[];
}

@Injectable({
  providedIn: 'root',
})
export class PedidosApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pedidos`;

  /**
   * Registra una nueva comanda (salón o domicilio) congelando precios en BD
   */
  crearPedido(pedido: CreatePedidoPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, pedido);
  }

  /**
   * Consulta pedidos con filtros opcionales
   */
  obtenerTodos(filtros?: { estado?: string; tipo?: string; id_mesa?: number; fecha?: string }): Observable<any[]> {
    let params = new HttpParams();
    if (filtros?.estado) params = params.set('estado', filtros.estado);
    if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros?.id_mesa) params = params.set('id_mesa', filtros.id_mesa.toString());
    if (filtros?.fecha) params = params.set('fecha', filtros.fecha);

    return this.http.get<any[]>(this.apiUrl, { params });
  }

  /**
   * Consulta las comandas activas de una mesa
   */
  obtenerPorMesa(idMesa: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mesa/${idMesa}`);
  }

  /**
   * Consulta un pedido por ID
   */
  obtenerPorId(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Actualiza el estado del pedido (enviada, cerrada, cancelada)
   */
  cambiarEstado(id: number, estado: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
