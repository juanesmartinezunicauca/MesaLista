import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

// Módulos de Angular Material
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
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
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  private breakpointObserver = inject(BreakpointObserver);

  @ViewChild('sidenav') sidenav!: MatSidenav;

  // Signal para detectar pantallas móviles/tablets (Handset / Small)
  isHandset = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Signal para el estado colapsado en Escritorio (modo Mini-Sidebar / Riel)
  isCollapsed = signal<boolean>(false);

  // Computados dinámicos para el comportamiento según el tamaño de pantalla
  sidenavMode = computed(() => (this.isHandset() ? 'over' : 'side'));
  sidenavOpened = computed(() => !this.isHandset());

  // Menú de navegación
  navItems: NavItem[] = [
    { icon: 'table_restaurant', label: 'Mesas', route: '/mesas' },
    { icon: 'delivery_dining', label: 'Domicilios', route: '/domicilios' },
    { icon: 'point_of_sale', label: 'Caja', route: '/caja' },
    { icon: 'inventory_2', label: 'Inventario', route: '/inventario' },
    { icon: 'bar_chart', label: 'Reportes', route: '/reportes' }
  ];

  // Alternar el colapso en modo escritorio
  toggleCollapse(): void {
    this.isCollapsed.update((val) => !val);
  }

  // Cierre automático al seleccionar una opción en móvil
  onNavItemClick(): void {
    if (this.isHandset()) {
      this.sidenav.close();
    }
  }
}
