export type RolUsuario = 'administrador' | 'cajero' | 'mesero' | 'cocina';
export type EstadoUsuario = 'activo' | 'inactivo';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
}

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  token?: string;
  iniciales?: string;
}
