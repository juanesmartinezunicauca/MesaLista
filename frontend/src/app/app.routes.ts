import { Routes } from '@angular/router';
import { Layout } from './shared/components/layout/layout';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
            './shared/components/en-construccion/en-construccion'
          ).then((m) => m.EnConstruccionComponent),
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

  { path: '**', redirectTo: 'login' },
];