import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Cliente, Producto } from '../../../core/models';

export interface ItemSeleccionado {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  ingredientes_removibles_disponibles?: string[];
  ingredientes_removidos?: string;
  observacion?: string;
}

@Component({
  selector: 'app-new-delivery-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatAutocompleteModule,
  ],
  templateUrl: './nuevo-domi-modal.html',
  styleUrls: ['./nuevo-domi-modal.scss'],
})
export class NewDeliveryDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  public dialogRef = inject(MatDialogRef<NewDeliveryDialogComponent>);
  private catalogoApi = inject(CatalogoApiService);
  private domiciliosApi = inject(DomiciliosApiService);

  deliveryForm: FormGroup;

  // Estados de catálogo y clientes
  productosCatalogo = signal<Producto[]>([]);
  cargandoCatalogo = signal<boolean>(false);
  guardando = signal<boolean>(false);
  errorEnvio = signal<string | null>(null);

  // Filtros de menú
  filtroCategoria = signal<string>('Todas');
  busquedaProducto = signal<string>('');

  // Autocompletado de clientes
  clientesSugeridos = signal<Cliente[]>([]);
  buscandoCliente = signal<boolean>(false);

  // Ítems agregados
  itemsSeleccionados = signal<ItemSeleccionado[]>([]);

  // Categorías dinámicas
  categorias = computed(() => {
    const list = this.productosCatalogo();
    const dynamic = Array.from(new Set(list.map((p) => p.categoria).filter(Boolean)));
    return ['Todas', ...dynamic.sort()];
  });

  // Productos filtrados según búsqueda y categoría
  productosFiltrados = computed(() => {
    let lista = this.productosCatalogo();
    const cat = this.filtroCategoria();
    const query = this.busquedaProducto().trim().toLowerCase();

    if (cat !== 'Todas') {
      lista = lista.filter((p) => p.categoria === cat);
    }

    if (query) {
      lista = lista.filter((p) => p.nombre.toLowerCase().includes(query));
    }

    return lista;
  });

  // Cálculo del total
  totalPedido = computed(() => {
    return this.itemsSeleccionados().reduce(
      (acc, item) => acc + item.cantidad * item.precio_unitario,
      0,
    );
  });

  constructor() {
    this.deliveryForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{7,15}$/)]],
      direccion: ['', [Validators.required, Validators.minLength(5)]],
      notas: ['', [Validators.maxLength(255)]],
    });
  }

  ngOnInit(): void {
    this.cargarCatalogo();
    this.suscribirBusquedaCliente();
  }

  cargarCatalogo(): void {
    this.cargandoCatalogo.set(true);
    this.catalogoApi.obtenerProductos({ disponible: true }).subscribe({
      next: (prods) => {
        this.productosCatalogo.set(prods);
        this.cargandoCatalogo.set(false);
      },
      error: () => {
        this.cargandoCatalogo.set(false);
      },
    });
  }

  suscribirBusquedaCliente(): void {
    const telControl = this.deliveryForm.get('telefono');
    if (!telControl) return;

    telControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
      )
      .subscribe((query: string) => {
        if (!query || query.trim().length < 3) {
          this.clientesSugeridos.set([]);
          return;
        }

        this.buscandoCliente.set(true);
        this.domiciliosApi.buscarClientes(query.trim()).subscribe({
          next: (clientes) => {
            this.clientesSugeridos.set(clientes);
            this.buscandoCliente.set(false);
          },
          error: () => {
            this.buscandoCliente.set(false);
          },
        });
      });
  }

  seleccionarCliente(cliente: Cliente): void {
    this.deliveryForm.patchValue({
      nombreCompleto: cliente.nombre,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
    });
    this.clientesSugeridos.set([]);
  }

  agregarProducto(prod: Producto): void {
    this.itemsSeleccionados.update((items) => {
      const index = items.findIndex((i) => i.id_producto === prod.id_producto);
      if (index >= 0) {
        const actual = items[index];
        const nuevos = [...items];
        nuevos[index] = { ...actual, cantidad: actual.cantidad + 1 };
        return nuevos;
      }

      return [
        ...items,
        {
          id_producto: prod.id_producto,
          nombre: prod.nombre,
          precio_unitario: Number(prod.precio_venta),
          cantidad: 1,
          ingredientes_removibles_disponibles: prod.ingredientes_removibles || [],
        },
      ];
    });
  }

  incrementarItem(id_producto: number): void {
    this.itemsSeleccionados.update((items) => {
      const index = items.findIndex((i) => i.id_producto === id_producto);
      if (index < 0) return items;
      const nuevos = [...items];
      nuevos[index] = { ...items[index], cantidad: items[index].cantidad + 1 };
      return nuevos;
    });
  }

  decrementarItem(id_producto: number): void {
    this.itemsSeleccionados.update((items) => {
      const index = items.findIndex((i) => i.id_producto === id_producto);
      if (index < 0) return items;

      if (items[index].cantidad > 1) {
        const nuevos = [...items];
        nuevos[index] = { ...items[index], cantidad: items[index].cantidad - 1 };
        return nuevos;
      }

      return items.filter((i) => i.id_producto !== id_producto);
    });
  }

  eliminarItem(id_producto: number): void {
    this.itemsSeleccionados.update((items) => items.filter((i) => i.id_producto !== id_producto));
  }

  toggleIngredienteItem(item: ItemSeleccionado, ing: string): void {
    const currentList = item.ingredientes_removidos
      ? item.ingredientes_removidos.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    let updatedList: string[];
    if (currentList.includes(ing)) {
      updatedList = currentList.filter((s) => s !== ing);
    } else {
      updatedList = [...currentList, ing];
    }
    item.ingredientes_removidos = updatedList.length > 0 ? updatedList.join(', ') : undefined;
  }

  isIngredienteRemovido(item: ItemSeleccionado, ing: string): boolean {
    if (!item.ingredientes_removidos) return false;
    return item.ingredientes_removidos
      .split(',')
      .map((s) => s.trim())
      .includes(ing);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    this.errorEnvio.set(null);

    if (this.deliveryForm.invalid || this.itemsSeleccionados().length === 0) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    const fv = this.deliveryForm.value;
    const payload = {
      cliente: {
        nombre: fv.nombreCompleto.trim(),
        telefono: fv.telefono.trim(),
        direccion: fv.direccion.trim(),
      },
      observacion: fv.notas ? fv.notas.trim() : undefined,
      items: this.itemsSeleccionados().map((it) => ({
        id_producto: it.id_producto,
        cantidad: it.cantidad,
        ingredientes_removidos: it.ingredientes_removidos || undefined,
        observacion: it.observacion || undefined,
      })),
    };

    this.domiciliosApi.crear(payload).subscribe({
      next: (domicilioCreado) => {
        this.guardando.set(false);
        this.dialogRef.close(domicilioCreado);
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al registrar el pedido a domicilio.';
        this.errorEnvio.set(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }
}
