import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta no especifica roles requeridos, se permite el acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.rol) {
      throw new ForbiddenException(
        'Acceso denegado: no se encontró información de rol en la sesión del usuario.',
      );
    }

    const tieneRolPermitido = requiredRoles.includes(user.rol);

    if (!tieneRolPermitido) {
      throw new ForbiddenException(
        `Acceso denegado: el rol '${user.rol}' no tiene permisos para acceder a este recurso.`,
      );
    }

    return true;
  }
}
