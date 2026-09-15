import { Routes } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar';
import { LoginComponent } from './shared/components/login/login';

export const routes: Routes = [
  { path: 'home', component: LoginComponent },
  { path: 'sidebar', component: SidebarComponent },
  { path: '', redirectTo: 'home', pathMatch: 'full' }, // Ruta por defecto
  { path: '**', redirectTo: 'home' }, // Ruta comodín para páginas no encontradas
];
