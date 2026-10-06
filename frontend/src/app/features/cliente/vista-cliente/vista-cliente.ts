import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Producto } from '../../../core/models/producto.model';
import { CreateDomicilioPayload } from '../../../core/models';

@Component({
  selector: 'app-vista-cliente',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './vista-cliente.html',
  styleUrl: './vista-cliente.scss',
})
export class VistaClienteComponent implements OnInit {
  authService = inject(AuthService);
  private catalogoService = inject(CatalogoApiService);
  private domiciliosApi = inject(DomiciliosApiService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  productos = signal<Producto[]>([]);
  categorias = signal<string[]>([]);
  categoriaSeleccionada = signal<string>('todas');
  busqueda = signal<string>('');
  isLoading = signal<boolean>(true);

  // Estados de Modales / Diálogos
  mostrarModalAuth = signal<boolean>(false);
  mostrarModalPedido = signal<boolean>(false);
  pedidoConfirmado = signal<{
    codigo: string;
    total: number;
    producto: string;
    direccion: string;
  } | null>(null);

  enviandoPedido = signal<boolean>(false);

  // Formulario de Pedido de Domicilio para Restaurante Real
  productoSeleccionado = signal<Producto | null>(null);
  cantidad = signal<number>(1);
  direccionEntrega = signal<string>('');
  telefonoContacto = signal<string>('');
  referenciaUbicacion = signal<string>('');
  observaciones = signal<string>('');
  metodoPago = signal<string>('Efectivo al recibir');

  // Filtro reactivo de productos por categoría y texto de búsqueda
  productosFiltrados = computed(() => {
    let prods = this.productos();
    const cat = this.categoriaSeleccionada();
    const query = this.busqueda().trim().toLowerCase();

    if (cat !== 'todas') {
      prods = prods.filter((p) => p.categoria.toLowerCase() === cat.toLowerCase());
    }

    if (query) {
      prods = prods.filter((p) => p.nombre.toLowerCase().includes(query));
    }

    return prods;
  });

  totalPedido = computed(() => {
    const precio = this.productoSeleccionado()?.precio_venta || 0;
    return precio * this.cantidad();
  });

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
    this.isLoading.set(true);
    this.catalogoService.obtenerProductos({ disponible: true }).subscribe({
      next: (prods) => {
        this.productos.set(prods);
        const cats = Array.from(new Set(prods.map((p) => p.categoria)));
        this.categorias.set(cats);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Error al cargar la carta del restaurante.', 'Cerrar', { duration: 3000 });
      },
    });
  }

  filtrarPorCategoria(cat: string): void {
    this.categoriaSeleccionada.set(cat);
  }

  actualizarBusqueda(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda.set(input.value);
  }

  solicitarDomicilio(producto?: Producto): void {
    // Si NO está autenticado, requerir registro o inicio de sesión
    if (!this.isAuthenticated()) {
      if (producto) {
        this.productoSeleccionado.set(producto);
      }
      this.mostrarModalAuth.set(true);
      return;
    }

    // Si SÍ está autenticado, abrir formulario de pedido de domicilio
    if (producto) {
      this.productoSeleccionado.set(producto);
    } else if (this.productos().length > 0) {
      this.productoSeleccionado.set(this.productos()[0]);
    }

    this.cantidad.set(1);
    this.direccionEntrega.set('');
    this.referenciaUbicacion.set('');
    this.observaciones.set('');
    this.mostrarModalPedido.set(true);
  }

  irALogin(): void {
    this.mostrarModalAuth.set(false);
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/cliente' } });
  }

  cerrarModalAuth(): void {
    this.mostrarModalAuth.set(false);
  }

  cerrarModalPedido(): void {
    this.mostrarModalPedido.set(false);
  }

  incrementarCantidad(): void {
    this.cantidad.update((c) => c + 1);
  }

  decrementarCantidad(): void {
    this.cantidad.update((c) => (c > 1 ? c - 1 : 1));
  }

  confirmarPedido(): void {
    const prod = this.productoSeleccionado();
    if (!prod || this.enviandoPedido()) return;

    if (!this.direccionEntrega().trim() || this.direccionEntrega().trim().length < 5) {
      this.snackBar.open(
        'Por favor ingresa una dirección de entrega válida (calle, carrera, barrio).',
        'Entendido',
        { duration: 4000 }
      );
      return;
    }

    if (!this.telefonoContacto().trim() || this.telefonoContacto().trim().length < 7) {
      this.snackBar.open(
        'Por favor ingresa un número de teléfono o celular válido para coordinar la entrega.',
        'Entendido',
        { duration: 4000 }
      );
      return;
    }

    const clienteNombre = this.currentUser()?.nombre || 'Cliente';
    const direccion = this.direccionEntrega().trim();
    const notasArray = [
      this.metodoPago() ? `Pago: ${this.metodoPago()}` : '',
      this.referenciaUbicacion().trim() ? `Ref: ${this.referenciaUbicacion().trim()}` : '',
      this.observaciones().trim() ? `Obs: ${this.observaciones().trim()}` : '',
    ].filter(Boolean);

    const payload: CreateDomicilioPayload = {
      cliente: {
        nombre: clienteNombre,
        telefono: this.telefonoContacto().trim(),
        direccion: direccion,
      },
      items: [
        {
          id_producto: prod.id_producto,
          cantidad: this.cantidad(),
          observacion: this.observaciones().trim() || undefined,
        },
      ],
      observacion: notasArray.length > 0 ? notasArray.join(' | ') : undefined,
    };

    this.enviandoPedido.set(true);

    this.domiciliosApi.crear(payload).subscribe({
      next: (domicilioCreado) => {
        this.enviandoPedido.set(false);
        const codigo = `DOM-${domicilioCreado.numero_pedido}`;
        const total = Number(domicilioCreado.totalCalculado || this.totalPedido());

        this.pedidoConfirmado.set({
          codigo,
          total,
          producto: `${this.cantidad()}x ${prod.nombre}`,
          direccion,
        });

        this.mostrarModalPedido.set(false);

        this.snackBar.open(
          `¡Pedido #${codigo} recibido! La comanda ya llegó a cocina y a domicilios para preparar.`,
          '¡Genial!',
          { duration: 6000 }
        );
      },
      error: (err) => {
        this.enviandoPedido.set(false);
        const msg = err.error?.message || 'No fue posible registrar tu pedido. Por favor intenta de nuevo.';
        this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }

  cerrarModalConfirmacion(): void {
    this.pedidoConfirmado.set(null);
  }

  cerrarSesion(): void {
    this.authService.logout('/cliente');
    this.snackBar.open('Has cerrado sesión correctamente.', 'Entendido', { duration: 3000 });
  }
}
