import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

// Angular Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';

interface IngredienteRemovibleConfig {
  id: string;
  nombre: string;
  activo: boolean;
}

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.scss',
})
export class ProductoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogoApi = inject(CatalogoApiService);

  productForm: FormGroup;
  isSaving = signal<boolean>(false);
  isLoadingProduct = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  productId = signal<number | null>(null);

  mensajeFeedback = signal<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Nuevo ingrediente a añadir
  nuevoIngredienteInput = signal<string>('');

  // Signal para gestionar la lista de ingredientes removibles de forma reactiva
  ingredientes = signal<IngredienteRemovibleConfig[]>([
    { id: '1', nombre: 'Cebolla', activo: true },
    { id: '2', nombre: 'Tomate', activo: true },
    { id: '3', nombre: 'Salsa Especial', activo: true },
    { id: '4', nombre: 'Pepinillos', activo: true },
  ]);

  categorias = signal<string[]>([
    'Hamburguesas',
    'Comidas Rápidas',
    'Entradas',
    'Bebidas',
    'Postres',
  ]);

  constructor() {
    this.productForm = this.fb.group({
      nombre: ['', [Validators.required]],
      categoria: ['Hamburguesas', [Validators.required]],
      precio_venta: [0, [Validators.required, Validators.min(0)]],
      costo: [0, [Validators.required, Validators.min(0)]],
      cantidad_inventario: [10, [Validators.required, Validators.min(0)]],
      disponible: [true],
    });
  }

  ngOnInit(): void {
    this.cargarCategorias();
    this.evaluarRutaModo();
  }

  private evaluarRutaModo(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      if (!isNaN(id) && id > 0) {
        this.isEditMode.set(true);
        this.productId.set(id);
        this.cargarProductoParaEdicion(id);
      }
    } else {
      this.isEditMode.set(false);
      this.productId.set(null);
    }
  }

  private cargarProductoParaEdicion(id: number): void {
    this.isLoadingProduct.set(true);
    this.catalogoApi.obtenerPorId(id).subscribe({
      next: (prod) => {
        this.isLoadingProduct.set(false);
        this.productForm.patchValue({
          nombre: prod.nombre,
          categoria: prod.categoria,
          precio_venta: prod.precio_venta,
          costo: prod.costo,
          cantidad_inventario: prod.cantidad_inventario,
          disponible: prod.disponible,
        });

        if (prod.ingredientes_removibles && prod.ingredientes_removibles.length > 0) {
          const list: IngredienteRemovibleConfig[] = prod.ingredientes_removibles.map(
            (ing, idx) => ({
              id: `${Date.now()}_${idx}`,
              nombre: ing,
              activo: true,
            })
          );
          this.ingredientes.set(list);
        }
      },
      error: (err) => {
        this.isLoadingProduct.set(false);
        this.mensajeFeedback.set({
          tipo: 'error',
          texto: 'No se pudo cargar la información del producto solicitado.',
        });
      },
    });
  }

  cargarCategorias(): void {
    this.catalogoApi.obtenerCategorias().subscribe({
      next: (cats) => {
        if (cats && cats.length > 0) {
          // Combinar con existentes para asegurar opciones
          const combinadas = Array.from(new Set([...this.categorias(), ...cats]));
          this.categorias.set(combinadas);
        }
      },
      error: () => {
        // Mantiene categorías por defecto si backend no responde
      },
    });
  }

  // Margen estimado basado en precio_venta y costo canónicos
  get estimatedMargin(): string {
    const precio = this.productForm.get('precio_venta')?.value || 0;
    const costo = this.productForm.get('costo')?.value || 0;
    if (precio <= 0) return '0%';
    const margen = ((precio - costo) / precio) * 100;
    return `${Math.round(margen)}%`;
  }

  toggleIngrediente(id: string): void {
    this.ingredientes.update((list) =>
      list.map((item) => (item.id === id ? { ...item, activo: !item.activo } : item))
    );
  }

  eliminarIngrediente(id: string): void {
    this.ingredientes.update((list) => list.filter((item) => item.id !== id));
  }

  agregarNuevoIngrediente(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) return;

    // Verificar si ya existe
    const yaExiste = this.ingredientes().some(
      (i) => i.nombre.toLowerCase() === limpio.toLowerCase()
    );
    if (yaExiste) return;

    this.ingredientes.update((list) => [
      ...list,
      {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nombre: limpio,
        activo: true,
      },
    ]);
    this.nuevoIngredienteInput.set('');
  }

  onSave(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.mensajeFeedback.set(null);

    const ingredientesRemovibles = this.ingredientes()
      .filter((i) => i.activo)
      .map((i) => i.nombre);

    const payload = {
      nombre: this.productForm.value.nombre,
      categoria: this.productForm.value.categoria,
      precio_venta: Number(this.productForm.value.precio_venta),
      costo: Number(this.productForm.value.costo),
      cantidad_inventario: Number(this.productForm.value.cantidad_inventario),
      disponible: Boolean(this.productForm.value.disponible),
      ingredientes_removibles: ingredientesRemovibles,
    };

    if (this.isEditMode() && this.productId()) {
      // Actualizar producto existente
      this.catalogoApi.actualizarProducto(this.productId()!, payload).subscribe({
        next: (productoActualizado) => {
          this.isSaving.set(false);
          this.mensajeFeedback.set({
            tipo: 'exito',
            texto: `¡Producto "${productoActualizado.nombre}" actualizado exitosamente!`,
          });

          setTimeout(() => {
            this.router.navigate(['/catalogo']);
          }, 900);
        },
        error: (err) => {
          this.isSaving.set(false);
          const errorMsg =
            err.error?.message ||
            (err.status === 0
              ? 'No fue posible conectar con el servidor backend.'
              : 'Error al actualizar el producto en el catálogo.');

          this.mensajeFeedback.set({
            tipo: 'error',
            texto: errorMsg,
          });
        },
      });
    } else {
      // Crear nuevo producto
      this.catalogoApi.crearProducto(payload).subscribe({
        next: (productoCreado) => {
          this.isSaving.set(false);
          this.mensajeFeedback.set({
            tipo: 'exito',
            texto: `¡Producto "${productoCreado.nombre}" creado exitosamente en el catálogo!`,
          });

          setTimeout(() => {
            this.router.navigate(['/catalogo']);
          }, 900);
        },
        error: (err) => {
          this.isSaving.set(false);
          const errorMsg =
            err.error?.message ||
            (err.status === 0
              ? 'No fue posible conectar con el servidor backend.'
              : 'Error al registrar el producto en el catálogo.');

          this.mensajeFeedback.set({
            tipo: 'error',
            texto: errorMsg,
          });
        },
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/catalogo']);
  }
}
