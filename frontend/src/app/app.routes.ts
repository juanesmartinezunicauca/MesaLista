import { Routes } from '@angular/router';
import { Layout } from './shared/components/layout/layout';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Ruta pública de autenticación
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent),
  },

  // Grupo de rutas que comparten el Layout Maestro (Sidebar + Header) protegidas por AuthGuard
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'mesas', pathMatch: 'full' },
      {
        path: 'mesas',
        loadComponent: () =>
          import('./features/mesas/plano-mesas/plano-mesas').then(
            (m) => m.PlanoMesasComponent
          ),
      },
      {
        path: 'caja',
        loadComponent: () =>
          import('./features/caja/apertura-caja/apertura-caja').then(
            (m) => m.AperturaCajaComponent
          ),
      },
      {
        path: 'caja/dashboard',
        loadComponent: () =>
          import('./features/caja/dashboard-caja/dashboard-caja').then(
            (m) => m.DashboardCajaComponent
          ),
      },
      {
        path: 'catalogo',
        loadComponent: () =>
          import(
            './features/catalogo/lista-productos/lista-productos'
          ).then((m) => m.ListaProductosComponent),
      },
      {
        path: 'catalogo/nuevo',
        loadComponent: () =>
          import(
            './features/catalogo/producto-form/producto-form'
          ).then((m) => m.ProductoFormComponent),
      },
      {
        path: 'catalogo/editar/:id',
        loadComponent: () =>
          import(
            './features/catalogo/producto-form/producto-form'
          ).then((m) => m.ProductoFormComponent),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/usuarios/lista-usuarios/lista-usuarios').then(
            (m) => m.ListaUsuariosComponent
          ),
      },
      // Compatibilidad con enlace previo
      { path: 'inventory', redirectTo: 'catalogo', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];