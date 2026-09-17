import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
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
export class BorradorPedidoComponent {
  @Input({ required: true }) mesa!: Mesa;
  @Output() cerrar = new EventEmitter<void>();
  @Output() pedidoEnviado = new EventEmitter<void>();

  mesasService = inject(MesasService);

  // Filtro de categorías del catálogo
  categorias = ['Todas', 'Hamburguesas', 'Comidas Rápidas', 'Entradas', 'Bebidas'];
  categoriaSeleccionada = signal<string>('Todas');
  busquedaProducto = signal<string>('');

  // Producto en proceso de personalización
  productoEnPersonalizacion = signal<ProductoCatalogo | null>(null);
  ingredientesSeleccionados = signal<string[]>([]);
  observacionLibre = signal<string>('');
  notaPedidoCocina = signal<string>('');

  // Catálogo filtrado
  productosFiltrados = () => {
    const cat = this.categoriaSeleccionada();
    const query = this.busquedaProducto().toLowerCase().trim();

    return this.mesasService.catalogoProductos().filter((p) => {
      const matchCat = cat === 'Todas' || p.categoria === cat;
      const matchQuery = !query || p.nombre.toLowerCase().includes(query);
      return matchCat && matchQuery && p.disponible;
    });
  };

  seleccionarCategoria(cat: string): void {
    this.categoriaSeleccionada.set(cat);
  }

  clickProducto(producto: ProductoCatalogo): void {
    if (producto.ingredientes_removibles.length > 0) {
      this.productoEnPersonalizacion.set(producto);
      this.ingredientesSeleccionados.set([...producto.ingredientes_removibles]);
      this.observacionLibre.set('');
    } else {
      this.mesasService.agregarItemBorrador(this.mesa.id_mesa, producto);
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

    this.mesasService.agregarItemBorrador(this.mesa.id_mesa, prod, {
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
    this.mesasService.modificarCantidadBorrador(this.mesa.id_mesa, item.id_item, delta);
  }

  enviarCocina(): void {
    const res = this.mesasService.enviarPedidoACocina(
      this.mesa.id_mesa,
      this.notaPedidoCocina().trim()
    );
    if (res.exito) {
      this.pedidoEnviado.emit();
    }
  }
}
