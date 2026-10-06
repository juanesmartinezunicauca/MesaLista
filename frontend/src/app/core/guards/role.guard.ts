import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { RolUsuario } from '../models/usuario.model';

/**
 * Guard de control de acceso basado en roles (RBAC) para el Frontend.
 * Valida que el rol del usuario autenticado coincida con los roles declarados en route.data['roles'].
 * Si el usuario no tiene los permisos suficientes, es redirigido a /mesas.
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (!currentUser) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const allowedRoles = (route.data?.['roles'] as RolUsuario[]) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(currentUser.rol)) {
    return true;
  }

  // Si el usuario es de rol cliente (estudiante), redirigir a su vista de cliente
  if (currentUser.rol === 'cliente') {
    return router.createUrlTree(['/cliente']);
  }

  // Redirigir al personal operativo a la vista principal (Mesas)
  return router.createUrlTree(['/mesas']);

};
