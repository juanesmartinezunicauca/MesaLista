import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Guard para proteger el acceso a la vista dedicada del carrito (/cliente/carrito):
 * Requiere que el usuario se encuentre autenticado (cualquier rol: cliente o colaborador).
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

  // Cualquier usuario autenticado (cliente o empleado) puede usar el carrito para pedir domicilios
  return true;
};
