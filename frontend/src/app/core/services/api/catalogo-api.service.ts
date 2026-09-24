import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Producto } from '../../models/producto.model';

export interface QueryProductoParams {
  categoria?: string;
  disponible?: boolean;
  busqueda?: string;
}

export interface CreateProductoPayload {
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo: number;
  cantidad_inventario?: number;
  controla_inventario?: boolean;
  disponible?: boolean;
  ingredientes_removibles?: string[];
  imagen?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogoApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/catalogo`;

  /**
   * Obtiene la lista de productos con filtros opcionales
   */
  obtenerProductos(filtros?: QueryProductoParams): Observable<Producto[]> {
    let params = new HttpParams();
    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros?.disponible !== undefined) params = params.set('disponible', filtros.disponible.toString());
    if (filtros?.busqueda) params = params.set('busqueda', filtros.busqueda);

    return this.http.get<any[]>(`${this.apiUrl}/productos`, { params }).pipe(
      map((productos) =>
        productos.map((p) => this.normalizarProducto(p))
      )
    );
  }

  /**
   * Obtiene las categorías activas
   */
  obtenerCategorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categorias`);
  }

  /**
   * Obtiene un producto por su identificador
   */
  obtenerPorId(id: number): Observable<Producto> {
    return this.http.get<any>(`${this.apiUrl}/productos/${id}`).pipe(
      map((p) => this.normalizarProducto(p))
    );
  }

  /**
   * Registra un nuevo producto en la carta
   */
  crearProducto(producto: CreateProductoPayload): Observable<Producto> {
    return this.http.post<any>(`${this.apiUrl}/productos`, producto).pipe(
      map((p) => this.normalizarProducto(p))
    );
  }

  /**
   * Modifica disponibilidad de un producto
   */
  cambiarDisponibilidad(id: number, disponible: boolean): Observable<Producto> {
    return this.http.patch<any>(`${this.apiUrl}/productos/${id}/disponibilidad`, { disponible }).pipe(
      map((p) => this.normalizarProducto(p))
    );
  }

  /**
   * Actualiza las propiedades de un producto existente
   */
  actualizarProducto(id: number, producto: Partial<CreateProductoPayload>): Observable<Producto> {
    return this.http.patch<any>(`${this.apiUrl}/productos/${id}`, producto).pipe(
      map((p) => this.normalizarProducto(p))
    );
  }

  /**
   * Elimina un producto si no tiene comandas asociadas
   */
  eliminarProducto(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/productos/${id}`);
  }

  private normalizarProducto(raw: any): Producto {
    let ingredientes: string[] = [];
    if (Array.isArray(raw.ingredientes_removibles)) {
      ingredientes = raw.ingredientes_removibles;
    } else if (typeof raw.ingredientes_removibles === 'string' && raw.ingredientes_removibles.trim()) {
      ingredientes = raw.ingredientes_removibles.split(',').map((s: string) => s.trim());
    }

    return {
      id_producto: raw.id_producto,
      nombre: raw.nombre,
      categoria: raw.categoria,
      precio_venta: Number(raw.precio_venta),
      costo: Number(raw.costo),
      cantidad_inventario: Number(raw.cantidad_inventario ?? 0),
      controla_inventario: Boolean(raw.controla_inventario ?? false),
      disponible: Boolean(raw.disponible),
      ingredientes_removibles: ingredientes,
      imagen: raw.imagen ?? null,
    };
  }
}
