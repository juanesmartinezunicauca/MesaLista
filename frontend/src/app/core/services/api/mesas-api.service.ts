import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BackendMesaItem {
  id_item: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number | string;
  ingredientes_removidos?: string | null;
  observacion?: string | null;
  producto?: {
    id_producto: number;
    nombre: string;
    categoria: string;
    precio_venta: number | string;
  };
}

export interface BackendMesaPedido {
  id_pedido: number;
  numero_pedido: number;
  tipo: 'salon' | 'domicilio';
  estado: 'enviada' | 'cerrada' | 'cancelada';
  fecha_hora: string;
  observacion?: string | null;
  items: BackendMesaItem[];
  usuario?: {
    id_usuario: number;
    nombre: string;
  };
}

export interface BackendMesa {
  id_mesa: number;
  numero: number;
  estado: 'libre' | 'ocupada';
  pedidos?: BackendMesaPedido[];
}

@Injectable({
  providedIn: 'root',
})
export class MesasApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/mesas`;

  /**
   * Consulta todas las mesas del restaurante con sus pedidos activos
   */
  obtenerTodas(estado?: string): Observable<BackendMesa[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<BackendMesa[]>(this.apiUrl, { params });
  }

  /**
   * Consulta el detalle de una mesa por ID
   */
  obtenerPorId(id: number): Observable<BackendMesa> {
    return this.http.get<BackendMesa>(`${this.apiUrl}/${id}`);
  }

  /**
   * Registra una nueva mesa física en el restaurante
   */
  crear(numero: number): Observable<BackendMesa> {
    return this.http.post<BackendMesa>(this.apiUrl, { numero });
  }

  /**
   * Actualiza el estado operativo (libre/ocupada) de la mesa
   */
  cambiarEstado(id: number, estado: 'libre' | 'ocupada'): Observable<BackendMesa> {
    return this.http.patch<BackendMesa>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  /**
   * Actualiza el número de mesa
   */
  actualizar(id: number, datos: { numero?: number; estado?: 'libre' | 'ocupada' }): Observable<BackendMesa> {
    return this.http.patch<BackendMesa>(`${this.apiUrl}/${id}`, datos);
  }

  /**
   * Retira una mesa del sistema
   */
  eliminar(id: number): Observable<{ mensaje: string; id_mesa: number }> {
    return this.http.delete<{ mensaje: string; id_mesa: number }>(`${this.apiUrl}/${id}`);
  }
}
