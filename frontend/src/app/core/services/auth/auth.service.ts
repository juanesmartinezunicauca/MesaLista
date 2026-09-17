import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Usuario, UsuarioSesion } from '../../models/usuario.model';

export interface LoginDto {
  usuario: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  usuario: Usuario;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/auth`;

  private readonly TOKEN_KEY = 'mesalista_access_token';
  private readonly USER_KEY = 'mesalista_user_session';

  // Signals reactivos para el estado de autenticación
  token = signal<string | null>(this.getStoredToken());
  currentUser = signal<UsuarioSesion | null>(this.getStoredUser());

  isAuthenticated = computed<boolean>(() => !!this.token());

  userRole = computed<string | undefined>(() => this.currentUser()?.rol);

  /**
   * Envía credenciales al backend para autenticar usuario
   */
  login(credentials: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        const sesionUsuario: UsuarioSesion = {
          id_usuario: res.usuario.id_usuario,
          nombre: res.usuario.nombre,
          usuario: res.usuario.usuario,
          rol: res.usuario.rol,
          token: res.accessToken,
          iniciales: this.generarIniciales(res.usuario.nombre),
        };

        this.guardarSesion(res.accessToken, sesionUsuario);
      })
    );
  }

  /**
   * Consulta el perfil actualizado del usuario con el token Bearer
   */
  obtenerPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/perfil`);
  }

  /**
   * Actualiza los datos del perfil propio (nombre y/o contraseña) y sincroniza la sesión
   */
  actualizarPerfil(datos: { nombre?: string; password?: string }): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/perfil`, datos).pipe(
      tap((userActualizado) => {
        const cur = this.currentUser();
        if (cur) {
          const nuevoUsuario: UsuarioSesion = {
            ...cur,
            nombre: userActualizado.nombre,
            usuario: userActualizado.usuario,
            rol: userActualizado.rol,
            iniciales: this.generarIniciales(userActualizado.nombre),
          };
          this.guardarSesion(this.token() || '', nuevoUsuario);
        }
      })
    );
  }

  /**
   * Cierra sesión eliminando credenciales y redirigiendo al login
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private guardarSesion(token: string, usuario: UsuarioSesion): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
    this.token.set(token);
    this.currentUser.set(usuario);
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private getStoredUser(): UsuarioSesion | null {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private generarIniciales(nombre: string): string {
    if (!nombre) return 'ML';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) {
      return partes[0].substring(0, 2).toUpperCase();
    }
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
}
