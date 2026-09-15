import { RolUsuario } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  usuario: string;
  rol: RolUsuario;
  nombre: string;
  iat?: number;
  exp?: number;
}
