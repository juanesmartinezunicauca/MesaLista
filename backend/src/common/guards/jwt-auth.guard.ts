import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Si el cliente envió un Bearer token en una ruta pública (ej. admin/cajero consultando catálogo),
      // intentar poblar req.user de forma opcional sin bloquear a visitantes anónimos o tokens vencidos.
      const req =
        typeof context.switchToHttp === 'function'
          ? context.switchToHttp()?.getRequest?.()
          : undefined;
      const authHeader = req?.headers?.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return this.intentarPoblarUsuarioPublico(context);
      }
      return true;
    }

    return super.canActivate(context);
  }

  private async intentarPoblarUsuarioPublico(
    context: ExecutionContext,
  ): Promise<boolean> {
    try {
      const result = super.canActivate(context);
      if (isObservable(result)) {
        await firstValueFrom(result);
      } else {
        await result;
      }
    } catch {
      // Ruta pública: ignorar token inválido/expirado y servir respuesta pública
    }
    return true;
  }
}
