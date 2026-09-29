import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Cliente, CreateDomicilioPayload, Domicilio } from '../../models';

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
   * Busca clientes registrados por teléfono o nombre para autocompletado en el formulario.
   */
  buscarClientes(query: string): Observable<Cliente[]> {
    const params = new HttpParams().set('query', query || '');
    return this.http.get<Cliente[]>(`${this.apiUrl}/clientes/buscar`, { params });
  }

  /**
   * Cambia la etapa operativa de un domicilio ('En Reparto', 'En Preparación', 'Cancelado').
   */
  cambiarEstado(id: number, estado: string, motivo?: string): Observable<Domicilio> {
    return this.http.patch<Domicilio>(`${this.apiUrl}/${id}/estado`, { estado, motivo });
  }

  /**
   * Cancela una comanda a domicilio y restituye el stock a inventario.
   */
  cancelar(id: number, motivo?: string): Observable<Domicilio> {
    return this.http.patch<Domicilio>(`${this.apiUrl}/${id}/cancelar`, { motivo });
  }
}
