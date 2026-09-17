import { Routes } from '@angular/router';
import { Layout } from './shared/components/layout/layout';
// import { roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  // Ruta pública (Login) fuera del layout principal
  { 
    path: 'login', 
    loadComponent: () => import('./shared/components/login/login').then(m => m.LoginComponent) 
  },

  // Grupo de Rutas protegidas que comparten el Layout Maestro (Sidebar + Header)
  {
    path: '',
    component: Layout,
    children: [
      { 
        path: 'inventory', 
        loadComponent: () => import('./shared/components/inventory/inventory').then(m => m.InventoryComponent) 
      },
      // ... tus otras vistas de meseros, cocina o reportes
    ]
  },

  { path: '**', redirectTo: 'login' }
];