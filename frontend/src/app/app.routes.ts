import { Routes } from '@angular/router';
import { Layout } from './shared/components/layout/layout';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { clienteViewGuard } from './core/guards/cliente-view.guard';
import { clienteCarritoGuard } from './core/guards/cliente-carrito.guard';

export const routes: Routes = [
  // Ruta inicial por defecto: Menú público del cliente
  { path: '', redirectTo: 'cliente', pathMatch: 'full' },

  // Vista pública de clientes / estudiantes (explorar catálogo y pedir domicilios)
  {
    path: 'cliente',
    canActivate: [clienteViewGuard],
    loadComponent: () =>
      import('./features/cliente/vista-cliente/vista-cliente').then(
        (m) => m.VistaClienteComponent
      ),
  },

  // Vista dedicada del Carrito de Compras (Requiere autenticación de cliente)
  {
    path: 'cliente/carrito',
    canActivate: [clienteCarritoGuard],
    loadComponent: () =>
      import('./features/cliente/vista-carrito/vista-carrito').then(
        (m) => m.VistaCarritoComponent
      ),
  },
  { path: 'carrito', redirectTo: 'cliente/carrito', pathMatch: 'full' },

  // Ruta pública de autenticación
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent),
  },

  // Grupo de rutas operativas del personal (Layout Maestro con Sidebar + Header)
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'mesas', pathMatch: 'full' },
      {
        path: 'mesas',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero', 'mesero'] },
        loadComponent: () =>
          import('./features/mesas/plano-mesas/plano-mesas').then(
            (m) => m.PlanoMesasComponent
          ),
      },
      {
        path: 'cocina',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero', 'mesero', 'cocina'] },
        loadComponent: () =>
          import('./features/cocina/vista-cocina/vista-cocina').then(
            (m) => m.VistaCocinaComponent
          ),
      },
      {
        path: 'caja',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero'] },
        loadComponent: () =>
          import('./features/caja/apertura-caja/apertura-caja').then(
            (m) => m.AperturaCajaComponent
          ),
      },
      {
        path: 'caja/dashboard',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero'] },
        loadComponent: () =>
          import('./features/caja/dashboard-caja/dashboard-caja').then(
            (m) => m.DashboardCajaComponent
          ),
      },
      {
        path: 'catalogo',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero'] },
        loadComponent: () =>
          import(
            './features/catalogo/lista-productos/lista-productos'
          ).then((m) => m.ListaProductosComponent),
      },
      {
        path: 'catalogo/nuevo',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import(
            './features/catalogo/producto-form/producto-form'
          ).then((m) => m.ProductoFormComponent),
      },
      {
        path: 'catalogo/editar/:id',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import(
            './features/catalogo/producto-form/producto-form'
          ).then((m) => m.ProductoFormComponent),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import('./features/usuarios/lista-usuarios/lista-usuarios').then(
            (m) => m.ListaUsuariosComponent
          ),
      },
      {
        path: 'domicilios',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero', 'mesero'] },
        loadComponent: () =>
          import(
            './features/domicilios/lista-domicilios/dashboard-domis'
          ).then((m) => m.DashboardDomisComponent),
      },
      {
        path: 'clientes',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero', 'mesero'] },
        loadComponent: () =>
          import(
            './features/clientes/vista-clientes/vista-clientes'
          ).then((m) => m.VistaClientesComponent),
      },
      {
        path: 'historial',
        canActivate: [roleGuard],
        data: { roles: ['administrador', 'cajero'] },
        loadComponent: () =>
          import(
            './features/historial/vista-historial/vista-historial'
          ).then((m) => m.VistaHistorialComponent),
      },
      {
        path: 'reportes',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import(
            './shared/components/en-construccion/en-construccion'
          ).then((m) => m.EnConstruccionComponent),
      },
      // Compatibilidad con enlace previo
      { path: 'inventory', redirectTo: 'catalogo', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'cliente' },
];