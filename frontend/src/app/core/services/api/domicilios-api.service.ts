import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateDomicilioPayload, Domicilio, EstadoServicioDomicilio } from '../../models';

@Injectable({
  providedIn: 'root',
})
export class DomiciliosApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/domicilios`;

  /**
   * Crea un nuevo pedido a domicilio con cliente, productos e inventario.
   */
  crear(payload: CreateDomicilioPayload): Observable<Domicilio> {
    return this.http.post<Domicilio>(this.apiUrl, payload);
  }

  /**
   * Obtiene todos los pedidos a domicilio con filtros opcionales.
   */
  obtenerTodos(filtros?: { estado?: string; fecha?: string; buscar?: string }): Observable<Domicilio[]> {
    let params = new HttpParams();
    if (filtros?.estado && filtros.estado !== 'Todos') {
      params = params.set('estado', filtros.estado);
    }
    if (filtros?.fecha) {
      params = params.set('fecha', filtros.fecha);
    }
    if (filtros?.buscar && filtros.buscar.trim()) {
      params = params.set('buscar', filtros.buscar.trim());
    }

    return this.http.get<Domicilio[]>(this.apiUrl, { params });
  }

  /**
   * Consulta el detalle de un pedido a domicilio por su ID.
   */
  obtenerPorId(id: number): Observable<Domicilio> {
    return this.http.get<Domicilio>(`${this.apiUrl}/${id}`);
  }

  /**
   * Consulta los pedidos del cliente actual autenticado.
   */
  obtenerMisPedidos(): Observable<Domicilio[]> {
    return this.http.get<Domicilio[]>(`${this.apiUrl}/mis-pedidos`);
  }



  /**
   * Cambia la etapa operativa de un domicilio ('Aceptar', 'En Preparación', 'En Reparto', 'Entregado', 'Cancelado').
   */
  cambiarEstado(
    id: number,
    estado: string,
    motivo?: string,
    repartidor_nombre?: string,
    repartidor_telefono?: string,
  ): Observable<Domicilio> {
    return this.http.patch<Domicilio>(`${this.apiUrl}/${id}/estado`, {
      estado,
      motivo,
      repartidor_nombre,
      repartidor_telefono,
    });
  }

  /**
   * Cancela una comanda a domicilio y restituye el stock a inventario.
   */
  cancelar(id: number, motivo?: string): Observable<Domicilio> {
    return this.http.patch<Domicilio>(`${this.apiUrl}/${id}/cancelar`, { motivo });
  }

  /**
   * Consulta pública del estado de atención del restaurante y recepción de domicilios.
   */
  obtenerEstadoServicio(): Observable<EstadoServicioDomicilio> {
    return this.http.get<EstadoServicioDomicilio>(`${this.apiUrl}/estado-servicio`);
  }

  /**
   * Permite al cajero o administrador activar o pausar la recepción de domicilios.
   */
  cambiarRecepcionDomicilios(recibiendo: boolean, motivo?: string): Observable<EstadoServicioDomicilio> {
    return this.http.patch<EstadoServicioDomicilio>(`${this.apiUrl}/estado-servicio`, {
      recibiendo,
      motivo,
    });
  }

  /**
   * Limpia todos los domicilios cerrados (entregados) y cancelados del historial.
   */
  limpiarHistorial(): Observable<{ eliminados: number; mensaje: string }> {
    return this.http.delete<{ eliminados: number; mensaje: string }>(`${this.apiUrl}/historial`);
  }

  /**
   * Elimina un pedido cerrado o cancelado específico del historial.
   */
  eliminar(id: number): Observable<{ exito: boolean; mensaje: string }> {
    return this.http.delete<{ exito: boolean; mensaje: string }>(`${this.apiUrl}/${id}`);
  }
}
