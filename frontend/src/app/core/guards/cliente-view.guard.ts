import { CanActivateFn } from '@angular/router';

/**
 * Guard para controlar el acceso a la vista pública de clientes/estudiantes (/cliente):
 * 1. Visitantes anónimos (no autenticados): Permite el acceso para explorar el menú.
 * 2. Usuarios autenticados con rol 'cliente': Permite el acceso.
 * 3. Personal administrativo y operativo (administrador, cajero, mesero, cocina):
 *    También puede acceder al portal cliente para explorar la carta y realizar pedidos personales.
 */
export const clienteViewGuard: CanActivateFn = () => {
  return true;
};
