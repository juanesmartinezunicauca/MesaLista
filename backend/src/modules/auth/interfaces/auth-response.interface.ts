import { EstadoUsuario, RolUsuario } from '@prisma/client';

export interface AuthUserResponse {
  id_usuario: number;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
}

export interface AuthResponse {
  accessToken: string;
  usuario: AuthUserResponse;
}
