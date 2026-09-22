import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Producto } from '../../../core/models/producto.model';

@Component({
  selector: 'app-lista-productos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './lista-productos.html',
  styleUrl: './lista-productos.scss',
})
export class ListaProductosComponent implements OnInit {
  private catalogoApi = inject(CatalogoApiService);
  private router = inject(Router);
  private authService = inject(AuthService);

  esAdmin = computed<boolean>(() => this.authService.currentUser()?.rol === 'administrador');

  productos = signal<Producto[]>([]);
  isLoading = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  // Filtros interactivos
  busqueda = signal<string>('');
  categoriaSeleccionada = signal<string>('Todas');
  filtroDisponibilidad = signal<'todos' | 'disponibles' | 'agotados'>('todos');

  // Categorías calculadas dinámicamente según productos en base de datos
  categoriasDisponibles = computed<string[]>(() => {
    const list = this.productos();
    const cats = Array.from(new Set(list.map((p) => p.categoria).filter(Boolean)));
    return ['Todas', ...cats.sort()];
  });

  // Métricas reactivas del catálogo
  metricas = computed(() => {
    const list = this.productos();
    const total = list.length;
    const disponibles = list.filter((p) => p.disponible).length;
    const agotados = list.filter((p) => !p.disponible).length;
    const bajoStock = list.filter((p) => p.controla_inventario && p.cantidad_inventario <= 5).length;
    return { total, disponibles, agotados, bajoStock };
  });

  // Lista de productos filtrada reactivamente, con campos calculados precargados
  // para evitar llamadas repetidas a funciones puras en cada ciclo de change detection.
  productosFiltrados = computed(() => {
    const list = this.productos();
    const cat = this.categoriaSeleccionada();
    const disp = this.filtroDisponibilidad();
    const term = this.busqueda().trim().toLowerCase();

    return list
      .filter((p) => {
        const coincideCat = cat === 'Todas' || p.categoria === cat;
        const coincideDisp =
          disp === 'todos' || (disp === 'disponibles' ? p.disponible : !p.disponible);
        const coincideTerm =
          !term ||
          p.nombre.toLowerCase().includes(term) ||
          p.categoria.toLowerCase().includes(term);
        return coincideCat && coincideDisp && coincideTerm;
      })
      .map((p) => ({
        ...p,
        margen: this.calcularMargen(p.precio_venta, p.costo),
        etiquetaStock: p.controla_inventario
          ? this.obtenerEtiquetaStock(p.cantidad_inventario)
          : '',
        claseStock: p.controla_inventario
          ? this.obtenerClaseStock(p.cantidad_inventario)
          : '',
      }));
  });

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.isLoading.set(true);
    this.errorMensaje.set(null);

    this.catalogoApi.obtenerProductos().subscribe({
      next: (data) => {
        this.isLoading.set(false);
        this.productos.set(data);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg =
          err.status === 0
            ? 'No fue posible conectar con el backend. Verifica que esté activo en el puerto 3000.'
            : 'Error al consultar el catálogo de productos.';
        this.errorMensaje.set(msg);
      },
    });
  }

  toggleDisponibilidad(producto: Producto, event?: unknown): void {
    if (event && typeof event === 'object' && 'stopPropagation' in event) {
      (event as { stopPropagation: () => void }).stopPropagation();
    }
    const nuevoEstado = !producto.disponible;

    // Optimista
    this.productos.update((list) =>
      list.map((p) => (p.id_producto === producto.id_producto ? { ...p, disponible: nuevoEstado } : p))
    );

    this.catalogoApi.cambiarDisponibilidad(producto.id_producto, nuevoEstado).subscribe({
      error: (err) => {
        console.error('Error al cambiar disponibilidad:', err);
        // Revertir en caso de fallo
        this.productos.update((list) =>
          list.map((p) => (p.id_producto === producto.id_producto ? { ...p, disponible: !nuevoEstado } : p))
        );
      },
    });
  }

  eliminarProducto(producto: Producto, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    const confirmar = confirm(`¿Estás seguro de eliminar el producto "${producto.nombre}" de la carta?`);
    if (!confirmar) return;

    this.catalogoApi.eliminarProducto(producto.id_producto).subscribe({
      next: () => {
        this.productos.update((list) => list.filter((p) => p.id_producto !== producto.id_producto));
      },
      error: (err) => {
        const msg = err.error?.message || 'No se puede eliminar el producto porque tiene pedidos registrados.';
        alert(msg);
      },
    });
  }

  irACrear(): void {
    this.router.navigate(['/catalogo/nuevo']);
  }

  irAEditar(producto: Producto): void {
    this.router.navigate(['/catalogo/editar', producto.id_producto]);
  }

  calcularMargen(precio: number, costo: number): string {
    if (precio <= 0) return '0%';
    const margen = ((precio - costo) / precio) * 100;
    return `${Math.round(margen)}%`;
  }

  obtenerEtiquetaStock(cantidad: number): string {
    if (cantidad <= 0) return 'Sin stock';
    if (cantidad <= 5) return `Bajo stock: ${cantidad}`;
    return `Stock: ${cantidad}`;
  }

  obtenerClaseStock(cantidad: number): string {
    if (cantidad <= 0) return 'out-of-stock';
    if (cantidad <= 5) return 'low-stock';
    return 'good-stock';
  }
}
