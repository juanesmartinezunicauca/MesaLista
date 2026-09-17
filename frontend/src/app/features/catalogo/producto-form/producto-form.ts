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
import { MatDividerModule } from '@angular/material/divider';

import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { MesasService } from '../../mesas/services/mesas.service';

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
    MatDividerModule,
  ],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.scss',
})
export class ProductoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogoApi = inject(CatalogoApiService);
  private mesasService = inject(MesasService);

  productForm: FormGroup;
  isSaving = signal<boolean>(false);
  isLoadingProduct = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  productId = signal<number | null>(null);

  mensajeFeedback = signal<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Nuevo ingrediente a añadir
  nuevoIngredienteInput = signal<string>('');

  // Signal para gestionar la lista de ingredientes de forma reactiva (inicia limpio para nuevos productos)
  ingredientes = signal<IngredienteRemovibleConfig[]>([]);

  // Categorías base sugeridas + personalizadas
  categorias = signal<string[]>([
    'Hamburguesas',
    'Comidas Rápidas',
    'Entradas',
    'Bebidas',
    'Postres',
  ]);

  // Modo de creación de categoría personalizada
  modoNuevaCategoria = signal<boolean>(false);
  nuevaCategoriaTexto = signal<string>('');

  constructor() {
    this.productForm = this.fb.group({
      nombre: ['', [Validators.required]],
      categoria: ['Hamburguesas', [Validators.required]],
      precio_venta: [null, [Validators.required, Validators.min(0)]],
      costo: [null, [Validators.required, Validators.min(0)]],
      cantidad_inventario: [null, [Validators.required, Validators.min(0)]],
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

        // Asegurar que la categoría del producto figure en la lista si es personalizada
        if (prod.categoria && !this.categorias().includes(prod.categoria)) {
          this.categorias.update((cats) => [...cats, prod.categoria].sort());
        }

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
          this.categorias.set(combinadas.sort());
        }
      },
      error: () => {
        // Mantiene categorías por defecto si backend no responde
      },
    });
  }

  activarModoNuevaCategoria(): void {
    this.modoNuevaCategoria.set(true);
    this.nuevaCategoriaTexto.set('');
  }

  cancelarModoNuevaCategoria(): void {
    this.modoNuevaCategoria.set(false);
    this.nuevaCategoriaTexto.set('');
  }

  guardarNuevaCategoria(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) return;

    // Normalizar primera letra a mayúscula
    const formateada = limpio.charAt(0).toUpperCase() + limpio.slice(1);

    const existente = this.categorias().find(
      (c) => c.toLowerCase() === formateada.toLowerCase()
    );

    const categoriaFinal = existente || formateada;

    if (!existente) {
      this.categorias.update((cats) => [...cats, formateada].sort());
    }

    this.productForm.get('categoria')?.setValue(categoriaFinal);
    this.productForm.get('categoria')?.markAsDirty();
    this.modoNuevaCategoria.set(false);
    this.nuevaCategoriaTexto.set('');
  }

  onCategoriaSelect(val: string): void {
    if (val === '__CREAR_NUEVA__') {
      // Revertir temporalmente la selección en el control para no dejar '__CREAR_NUEVA__'
      this.productForm.get('categoria')?.setValue('');
      this.activarModoNuevaCategoria();
    }
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

      const camposFaltantes: string[] = [];
      if (this.productForm.get('nombre')?.invalid) camposFaltantes.push('Nombre del producto');
      if (this.productForm.get('categoria')?.invalid) camposFaltantes.push('Categoría');
      if (this.productForm.get('cantidad_inventario')?.invalid) camposFaltantes.push('Cantidad en inventario (Stock)');
      if (this.productForm.get('precio_venta')?.invalid) camposFaltantes.push('Precio de venta');
      if (this.productForm.get('costo')?.invalid) camposFaltantes.push('Costo');

      const detalle = camposFaltantes.length > 0
        ? `: falta completar ${camposFaltantes.join(', ')}.`
        : '. Por favor revisa los campos requeridos en rojo.';

      this.mensajeFeedback.set({
        tipo: 'error',
        texto: `No se puede guardar el producto${detalle}`,
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
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

          // Sincronizar catálogo de mesas de inmediato
          this.mesasService.cargarCatalogo();

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

          // Sincronizar catálogo de mesas de inmediato
          this.mesasService.cargarCatalogo();

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
