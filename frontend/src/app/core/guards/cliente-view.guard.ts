import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Guard para controlar el acceso a la vista pública de clientes/estudiantes (/cliente):
 * 1. Visitantes anónimos (no autenticados): Permite el acceso para explorar el menú.
 * 2. Usuarios autenticados con rol 'cliente': Permite el acceso.
 * 3. Personal administrativo y operativo (administrador, cajero, mesero, cocina):
 *    No deben ver la vista de cliente una vez autenticados -> Redirige a /mesas.
 */
export const clienteViewGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  // Si no está autenticado, tiene acceso público a la carta
  if (!currentUser) {
    return true;
  }

  // Si es un cliente autenticado, tiene acceso a su portal
  if (currentUser.rol === 'cliente') {
    return true;
  }

  // El personal de la cafetería/restaurante siempre es redirigido a las operaciones del POS
  return router.createUrlTree(['/mesas']);
};
