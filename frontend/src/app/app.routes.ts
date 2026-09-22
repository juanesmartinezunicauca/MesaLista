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
      // Compatibilidad con enlace previo
      { path: 'inventory', redirectTo: 'catalogo', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];