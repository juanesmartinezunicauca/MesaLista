import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Guard para proteger el acceso a la vista dedicada del carrito (/cliente/carrito):
 * Requiere estrictamente que el usuario se encuentre autenticado (rol 'cliente').
 * Si no está autenticado, redirige a /cliente con query param ?auth=required para abrir el diálogo de login.
 */
export const clienteCarritoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  // Si no hay sesión activa, redirige a la carta con solicitud de login
  if (!currentUser) {
    return router.createUrlTree(['/cliente'], {
      queryParams: { auth: 'required' },
    });
  }

  // Si es un cliente autenticado, permite el acceso al carrito
  if (currentUser.rol === 'cliente') {
    return true;
  }

  // Si es un empleado o administrador, redirige a su área operativa (mesas)
  return router.createUrlTree(['/mesas']);
};
