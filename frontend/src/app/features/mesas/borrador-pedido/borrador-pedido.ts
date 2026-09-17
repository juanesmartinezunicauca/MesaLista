import { Component, EventEmitter, Input, Output, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ItemPedido, Mesa, ProductoCatalogo } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';

@Component({
  selector: 'app-borrador-pedido',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  templateUrl: './borrador-pedido.html',
  styleUrl: './borrador-pedido.scss',
})
export class BorradorPedidoComponent implements OnInit {
  @Input({ required: true }) mesa!: Mesa;
  @Output() cerrar = new EventEmitter<void>();
  @Output() pedidoEnviado = new EventEmitter<void>();

  mesasService = inject(MesasService);

  // Mesa reactiva vinculada directamente al estado global de mesasService
  mesaActual = computed<Mesa>(() => {
    const fromService = this.mesasService.mesas().find((m) => m.id_mesa === this.mesa?.id_mesa);
    return fromService || this.mesa;
  });

  // Categorías calculadas dinámicamente desde los productos disponibles en el catálogo
  categorias = computed(() => {
    const list = this.mesasService.catalogoProductos();
    const dynamicCats = Array.from(new Set(list.map((p) => p.categoria).filter(Boolean)));
    return ['Todas', ...dynamicCats.sort()];
  });

  categoriaSeleccionada = signal<string>('Todas');
  busquedaProducto = signal<string>('');

  // Producto en proceso de personalización
  productoEnPersonalizacion = signal<ProductoCatalogo | null>(null);
  ingredientesSeleccionados = signal<string[]>([]);
  observacionLibre = signal<string>('');
  notaPedidoCocina = signal<string>('');

  // Total a despachar del pedido actual en borrador (exclusivo de los ítems de este pedido)
  totalPedidoActual = computed<number>(() => {
    return this.mesaActual().borrador_local.reduce((acc, item) => acc + item.subtotal, 0);
  });

  ngOnInit(): void {
    // Al abrir el borrador de pedido, refresca el catálogo desde el backend
    this.mesasService.cargarCatalogo();
  }

  // Catálogo filtrado reactivo
  productosFiltrados = computed(() => {
    const cat = this.categoriaSeleccionada();
    const query = this.busquedaProducto().toLowerCase().trim();

    return this.mesasService.catalogoProductos().filter((p) => {
      const matchCat = cat === 'Todas' || p.categoria.toLowerCase() === cat.toLowerCase();
      const matchQuery = !query || p.nombre.toLowerCase().includes(query);
      return matchCat && matchQuery && p.disponible;
    });
  });

  seleccionarCategoria(cat: string): void {
    this.categoriaSeleccionada.set(cat);
  }

  clickProducto(producto: ProductoCatalogo): void {
    if (producto.ingredientes_removibles.length > 0) {
      this.productoEnPersonalizacion.set(producto);
      this.ingredientesSeleccionados.set([...producto.ingredientes_removibles]);
      this.observacionLibre.set('');
    } else {
      this.mesasService.agregarItemBorrador(this.mesaActual().id_mesa, producto);
    }
  }

  toggleIngrediente(ing: string): void {
    this.ingredientesSeleccionados.update((actuales) => {
      if (actuales.includes(ing)) {
        return actuales.filter((i) => i !== ing);
      } else {
        return [...actuales, ing];
      }
    });
  }

  confirmarPersonalizacion(): void {
    const prod = this.productoEnPersonalizacion();
    if (!prod) return;

    const removidos = prod.ingredientes_removibles.filter(
      (ing) => !this.ingredientesSeleccionados().includes(ing)
    );

    this.mesasService.agregarItemBorrador(this.mesaActual().id_mesa, prod, {
      ingredientes_removibles: prod.ingredientes_removibles,
      ingredientes_removidos: removidos,
      observacion: this.observacionLibre().trim(),
    });

    this.cancelarPersonalizacion();
  }

  cancelarPersonalizacion(): void {
    this.productoEnPersonalizacion.set(null);
    this.ingredientesSeleccionados.set([]);
    this.observacionLibre.set('');
  }

  modificarCantidad(item: ItemPedido, delta: number): void {
    this.mesasService.modificarCantidadBorrador(this.mesaActual().id_mesa, item.id_item, delta);
  }

  enviarCocina(): void {
    const res = this.mesasService.enviarPedidoACocina(
      this.mesaActual().id_mesa,
      this.notaPedidoCocina().trim()
    );
    if (res.exito) {
      this.pedidoEnviado.emit();
    }
  }
}
