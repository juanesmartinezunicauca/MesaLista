import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Módulos de Angular Material
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth/auth.service';
import { RolUsuario } from '../../../core/models/usuario.model';

export interface NavItem {
  icon: string;
  label: string;
  route: string;
  roles?: RolUsuario[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {
  private authService = inject(AuthService);

  // Signal para el estado colapsado (modo Riel en escritorio)
  isCollapsed = signal<boolean>(false);

  // Menú de navegación adaptado a Luigie's POS con roles permitidos
  navItems: NavItem[] = [
    { icon: 'table_restaurant', label: 'Mesas', route: '/mesas', roles: ['administrador', 'cajero', 'mesero'] },
    { icon: 'delivery_dining', label: 'Domicilios', route: '/domicilios', roles: ['administrador', 'cajero', 'mesero'] },
    { icon: 'point_of_sale', label: 'Caja', route: '/caja', roles: ['administrador', 'cajero'] },
    { icon: 'inventory_2', label: 'Catálogo', route: '/catalogo', roles: ['administrador', 'cajero'] },
    { icon: 'manage_accounts', label: 'Personal', route: '/usuarios', roles: ['administrador'] },
    { icon: 'bar_chart', label: 'Reportes', route: '/reportes', roles: ['administrador'] }
  ];

  // Filtra los items visibles según el rol del usuario logueado
  navItemsFiltrados = computed(() => {
    const rol = this.authService.currentUser()?.rol;
    if (!rol) return [];
    return this.navItems.filter(item => !item.roles || item.roles.includes(rol));
  });

  toggleCollapse(): void {
    this.isCollapsed.update(val => !val);
  }
}