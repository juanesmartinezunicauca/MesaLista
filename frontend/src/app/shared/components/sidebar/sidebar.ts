import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Módulos de Angular Material
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

interface NavItem {
  icon: string;
  label: string;
  route: string;
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
  // Signal para el estado colapsado (modo Riel en escritorio)
  isCollapsed = signal<boolean>(false);

  // Menú de navegación adaptado a Luigie's POS
  navItems: NavItem[] = [
    { icon: 'table_restaurant', label: 'Mesas', route: '/mesas' },
    { icon: 'delivery_dining', label: 'Domicilios', route: '/domicilios' },
    { icon: 'point_of_sale', label: 'Caja', route: '/caja' },
    { icon: 'inventory_2', label: 'Catálogo', route: '/catalogo' },
    { icon: 'manage_accounts', label: 'Personal', route: '/usuarios' },
    { icon: 'bar_chart', label: 'Reportes', route: '/reportes' }
  ];

  toggleCollapse(): void {
    this.isCollapsed.update(val => !val);
  }
}