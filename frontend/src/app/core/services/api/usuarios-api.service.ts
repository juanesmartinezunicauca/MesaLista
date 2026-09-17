import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EstadoUsuario, RolUsuario, Usuario } from '../../models/usuario.model';

export interface QueryUsuarioParams {
  rol?: RolUsuario;
  estado?: EstadoUsuario;
  buscar?: string;
}

export interface CreateUsuarioPayload {
  nombre: string;
  usuario: string;
  password: string;
  rol: RolUsuario;
  estado?: EstadoUsuario;
}

export interface UpdateUsuarioPayload {
  nombre?: string;
  usuario?: string;
  password?: string;
  rol?: RolUsuario;
  estado?: EstadoUsuario;
}

export interface RespuestaEliminarUsuario {
  mensaje: string;
  tipo: 'soft-delete' | 'hard-delete';
  id_usuario: number;
  estado?: EstadoUsuario;
}

@Injectable({
  providedIn: 'root',
})
export class UsuariosApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/usuarios`;

  /**
   * Consulta usuarios registrados con filtros opcionales (rol, estado, buscar)
   */
  obtenerTodos(filtros?: QueryUsuarioParams): Observable<Usuario[]> {
    let params = new HttpParams();
    if (filtros?.rol) params = params.set('rol', filtros.rol);
    if (filtros?.estado) params = params.set('estado', filtros.estado);
    if (filtros?.buscar) params = params.set('buscar', filtros.buscar);
    return this.http.get<Usuario[]>(this.apiUrl, { params });
  }

  /**
   * Consulta un usuario por su ID
   */
  obtenerPorId(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  /**
   * Registra un nuevo empleado / usuario en el sistema
   */
  crear(payload: CreateUsuarioPayload): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, payload);
  }

  /**
   * Actualiza datos de un usuario existente
   */
  actualizar(id: number, payload: UpdateUsuarioPayload): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}`, payload);
  }

  /**
   * Activa o desactiva un usuario
   */
  cambiarEstado(id: number, estado: EstadoUsuario): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  /**
   * Elimina o da de baja (soft-delete) a un usuario
   */
  eliminar(id: number): Observable<RespuestaEliminarUsuario> {
    return this.http.delete<RespuestaEliminarUsuario>(`${this.apiUrl}/${id}`);
  }
}
