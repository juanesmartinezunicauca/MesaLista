import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
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
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Producto } from '../../../core/models/producto.model';
import { CreateDomicilioPayload, Domicilio, EstadoServicioDomicilio } from '../../../core/models';

export interface CartItem {
  producto: Producto;
  cantidad: number;
  observacion?: string;
  ingredientes_removidos?: string[];
}

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
    MatBadgeModule,
  ],
  templateUrl: './vista-cliente.html',
  styleUrl: './vista-cliente.scss',
})
export class VistaClienteComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private catalogoService = inject(CatalogoApiService);
  private domiciliosApi = inject(DomiciliosApiService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Navegación de secciones del cliente: Carta vs Mis Pedidos
  vistaActiva = signal<'carta' | 'mis-pedidos'>('carta');

  // Catálogo de productos
  productos = signal<Producto[]>([]);
  categorias = signal<string[]>([]);
  categoriaSeleccionada = signal<string>('todas');
  busqueda = signal<string>('');
  isLoading = signal<boolean>(true);

  // Estado del servicio de domicilios (Caja abierta y toggle del cajero)
  estadoServicio = signal<EstadoServicioDomicilio | null>(null);

  // Carrito de compras persistente en localStorage
  private readonly CART_STORAGE_KEY = 'mesalista_cliente_carrito';
  carrito = signal<CartItem[]>([]);
  mostrarModalCarrito = signal<boolean>(false);

  // Estados de Modales / Diálogos
  mostrarModalAuth = signal<boolean>(false);
  mostrarModalPedido = signal<boolean>(false);
  productoEnPersonalizacion = signal<Producto | null>(null);
  ingredientesSeleccionados = signal<string[]>([]);
  observacionItemPersonalizado = signal<string>('');
  pedidoConfirmado = signal<{
    codigo: string;
    total: number;
    producto: string;
    direccion: string;
    metodoPago: string;
  } | null>(null);

  // Mis Pedidos y Seguimiento de pedidos del cliente
  misPedidos = signal<Domicilio[]>([]);
  cargandoMisPedidos = signal<boolean>(false);
  pedidoActivoTracking = signal<Domicilio | null>(null);
  private intervaloTracking: any = null;
  private intervaloServicio: any = null;

  enviandoPedido = signal<boolean>(false);

  // Formulario de Pedido de Domicilio
  productoSeleccionado = signal<Producto | null>(null);
  cantidad = signal<number>(1);
  nombreCliente = signal<string>('');
  direccionEntrega = signal<string>('');
  telefonoContacto = signal<string>('');
  referenciaUbicacion = signal<string>('');
  observaciones = signal<string>('');
  metodoPago = signal<string>('Efectivo');

  // WhatsApp de soporte y recepción de comprobantes
  readonly WHATSAPP_SOPORTE_NUMERO = '573001234567';
  readonly WHATSAPP_SOPORTE_DISPLAY = '+57 300 123 4567';

  // Conteo de pedidos activos en curso
  pedidosActivosCount = computed(() => {
    const list = this.misPedidos();
    const activosEnLista = list.filter(
      (p) => p.etapaOperativa !== 'Entregado' && p.etapaOperativa !== 'Cancelado'
    ).length;

    const tracking = this.pedidoActivoTracking();
    if (
      tracking &&
      tracking.etapaOperativa !== 'Entregado' &&
      tracking.etapaOperativa !== 'Cancelado' &&
      !list.some((p) => p.id_pedido === tracking.id_pedido)
    ) {
      return activosEnLista + 1;
    }
    return activosEnLista;
  });

  // Cálculos reactivos de Carrito
  totalCartItems = computed(() =>
    this.carrito().reduce((sum, item) => sum + item.cantidad, 0)
  );

  totalCartPrecio = computed(() =>
    this.carrito().reduce(
      (sum, item) => sum + item.cantidad * Number(item.producto.precio_venta),
      0
    )
  );

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
    if (this.carrito().length > 0) {
      return this.totalCartPrecio();
    }
    const precio = this.productoSeleccionado()?.precio_venta || 0;
    return Number(precio) * this.cantidad();
  });

  ngOnInit(): void {
    this.recuperarCarrito();
    this.cargarCatalogo();
    this.cargarEstadoServicio();

    if (this.isAuthenticated()) {
      this.cargarMisPedidos();
      this.recuperarUltimoPedido();
    }

    // Polling de verificación de estado del servicio cada 15 segundos
    this.intervaloServicio = setInterval(() => {
      this.cargarEstadoServicio();
      if (this.isAuthenticated() && this.vistaActiva() === 'mis-pedidos') {
        this.cargarMisPedidos(false);
      }
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.intervaloTracking) {
      clearInterval(this.intervaloTracking);
      this.intervaloTracking = null;
    }
    if (this.intervaloServicio) {
      clearInterval(this.intervaloServicio);
      this.intervaloServicio = null;
    }
  }

  cargarCatalogo(): void {
    this.isLoading.set(true);
    this.catalogoService.obtenerProductos({ disponible: true }).subscribe({
      next: (prods) => {
        this.productos.set(prods);
        const cats = Array.from(new Set(prods.map((p) => p.categoria)));
        this.categorias.set(cats);

        // Elegir por defecto "Hamburguesas" para no mostrar todo apenas entrar
        const catHamburguesa = cats.find((c) =>
          c.toLowerCase().includes('hamburguesa')
        );
        if (catHamburguesa) {
          this.categoriaSeleccionada.set(catHamburguesa);
        } else if (cats.length > 0 && this.categoriaSeleccionada() === 'todas') {
          this.categoriaSeleccionada.set(cats[0]);
        }

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Error al cargar la carta del restaurante.', 'Cerrar', {
          duration: 3000,
        });
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

  cargarEstadoServicio(): void {
    this.domiciliosApi.obtenerEstadoServicio().subscribe({
      next: (estado) => this.estadoServicio.set(estado),
      error: () => {},
    });
  }

  cargarMisPedidos(mostrarSpinner: boolean = true): void {
    if (mostrarSpinner) this.cargandoMisPedidos.set(true);
    this.domiciliosApi.obtenerMisPedidos().subscribe({
      next: (pedidos) => {
        this.misPedidos.set(pedidos);
        this.cargandoMisPedidos.set(false);
        const activos = pedidos.filter(
          (p) => p.etapaOperativa !== 'Entregado' && p.etapaOperativa !== 'Cancelado'
        );
        if (activos.length > 0) {
          this.pedidoActivoTracking.set(activos[0]);
        }
      },
      error: () => {
        this.cargandoMisPedidos.set(false);
      },
    });
  }

  abrirMisPedidos(): void {
    this.vistaActiva.set('mis-pedidos');
    if (this.isAuthenticated()) {
      this.cargarMisPedidos();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  irAInicio(): void {
    const rol = this.currentUser()?.rol;
    if (rol && rol !== 'cliente') {
      this.router.navigate(['/mesas']);
    } else {
      this.vistaActiva.set('carta');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Métodos de Persistencia de Carrito en localStorage
  private guardarCarrito(): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(this.carrito()));
    } catch {}
  }

  private recuperarCarrito(): void {
    try {
      const guardado = localStorage.getItem(this.CART_STORAGE_KEY);
      if (guardado) {
        const items = JSON.parse(guardado);
        if (Array.isArray(items) && items.length > 0) {
          this.carrito.set(items);
        }
      }
    } catch {}
  }

  // Métodos de Personalización de Ingredientes y Carrito
  iniciarPersonalizacion(producto: Producto, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.productoEnPersonalizacion.set(producto);
    this.ingredientesSeleccionados.set([...(producto.ingredientes_removibles || [])]);
    this.observacionItemPersonalizado.set('');
  }

  toggleIngrediente(ing: string): void {
    const list = this.ingredientesSeleccionados();
    if (list.includes(ing)) {
      this.ingredientesSeleccionados.set(list.filter((i) => i !== ing));
    } else {
      this.ingredientesSeleccionados.set([...list, ing]);
    }
  }

  cancelarPersonalizacion(): void {
    this.productoEnPersonalizacion.set(null);
  }

  confirmarPersonalizacion(): void {
    const prod = this.productoEnPersonalizacion();
    if (!prod) return;

    const removidos = (prod.ingredientes_removibles || []).filter(
      (ing) => !this.ingredientesSeleccionados().includes(ing)
    );

    this.agregarItemPersonalizadoAlCarrito(
      prod,
      removidos,
      this.observacionItemPersonalizado().trim() || undefined
    );

    this.productoEnPersonalizacion.set(null);
  }

  agregarAlCarrito(producto: Producto, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.agregarItemPersonalizadoAlCarrito(producto, [], undefined);
  }

  agregarItemPersonalizadoAlCarrito(
    producto: Producto,
    removidos: string[],
    observacion?: string
  ): void {
    const items = [...this.carrito()];
    const removidosKey = (removidos || []).slice().sort().join('|');

    const index = items.findIndex((it) => {
      const itRemovidosKey = (it.ingredientes_removidos || []).slice().sort().join('|');
      return (
        it.producto.id_producto === producto.id_producto &&
        itRemovidosKey === removidosKey &&
        (it.observacion || '') === (observacion || '')
      );
    });

    if (index >= 0) {
      items[index] = {
        ...items[index],
        cantidad: items[index].cantidad + 1,
      };
    } else {
      items.push({
        producto,
        cantidad: 1,
        ingredientes_removidos: removidos.length > 0 ? removidos : undefined,
        observacion,
      });
    }

    this.carrito.set(items);
    this.guardarCarrito();

    const snackRef = this.snackBar.open(
      `¡${producto.nombre} agregado al carrito!`,
      'Ver Carrito',
      { duration: 3000 }
    );
    if (snackRef?.onAction) {
      snackRef.onAction().subscribe(() => {
        this.abrirCarrito();
      });
    }
  }

  incrementarItemCart(index: number): void {
    const items = [...this.carrito()];
    if (items[index]) {
      items[index] = {
        ...items[index],
        cantidad: items[index].cantidad + 1,
      };
      this.carrito.set(items);
      this.guardarCarrito();
    }
  }

  decrementarItemCart(index: number): void {
    const items = [...this.carrito()];
    if (!items[index]) return;

    if (items[index].cantidad > 1) {
      items[index] = {
        ...items[index],
        cantidad: items[index].cantidad - 1,
      };
      this.carrito.set(items);
      this.guardarCarrito();
    } else {
      this.eliminarItemCart(index);
    }
  }

  eliminarItemCart(index: number): void {
    const items = [...this.carrito()];
    items.splice(index, 1);
    this.carrito.set(items);
    this.guardarCarrito();
  }

  vaciarCarrito(): void {
    this.carrito.set([]);
    try {
      localStorage.removeItem(this.CART_STORAGE_KEY);
    } catch {}
  }

  abrirCarrito(): void {
    this.mostrarModalCarrito.set(true);
  }

  cerrarCarrito(): void {
    this.mostrarModalCarrito.set(false);
  }

  iniciarCheckout(): void {
    if (this.carrito().length === 0) {
      this.snackBar.open('Tu carrito está vacío. Agrega platos para continuar.', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    if (this.estadoServicio() && !this.estadoServicio()?.activo) {
      this.snackBar.open(
        `En este momento no hay servicio de domicilios: ${this.estadoServicio()?.motivo || 'Servicio cerrado'}`,
        'Entendido',
        { duration: 5000 }
      );
      return;
    }

    if (!this.isAuthenticated()) {
      this.guardarCarrito();
      const snackRef = this.snackBar.open(
        'Tus platos están guardados en tu carrito. Inicia sesión o regístrate para ingresar tus datos y enviar el pedido.',
        'Iniciar Sesión',
        { duration: 6000 }
      );
      if (snackRef?.onAction) {
        snackRef.onAction().subscribe(() => {
          this.irALogin();
        });
      }
      this.mostrarModalCarrito.set(false);
      this.mostrarModalAuth.set(true);
      return;
    }

    if (!this.nombreCliente() && this.currentUser()?.nombre) {
      this.nombreCliente.set(this.currentUser()!.nombre);
    }

    this.mostrarModalCarrito.set(false);
    this.mostrarModalPedido.set(true);
  }

  solicitarDomicilio(producto?: Producto): void {
    if (this.estadoServicio() && !this.estadoServicio()?.activo) {
      this.snackBar.open(
        `En este momento no hay servicio de domicilios: ${this.estadoServicio()?.motivo || 'Servicio cerrado'}`,
        'Entendido',
        { duration: 5000 }
      );
      return;
    }

    if (!this.isAuthenticated()) {
      if (producto) {
        this.productoSeleccionado.set(producto);
        this.agregarAlCarrito(producto);
      }
      this.mostrarModalAuth.set(true);
      return;
    }

    if (producto) {
      this.productoSeleccionado.set(producto);
      const existe = this.carrito().some(
        (it) => it.producto.id_producto === producto.id_producto
      );
      if (!existe) {
        this.carrito.set([{ producto, cantidad: 1 }]);
        this.guardarCarrito();
      }
    } else if (this.carrito().length === 0 && this.productos().length > 0) {
      this.productoSeleccionado.set(this.productos()[0]);
      this.carrito.set([{ producto: this.productos()[0], cantidad: 1 }]);
      this.guardarCarrito();
    }

    if (!this.nombreCliente() && this.currentUser()?.nombre) {
      this.nombreCliente.set(this.currentUser()!.nombre);
    }

    this.cantidad.set(1);
    this.direccionEntrega.set('');
    this.referenciaUbicacion.set('');
    this.observaciones.set('');
    this.mostrarModalPedido.set(true);
  }

  generarUrlWhatsApp(codigoPedido?: string): string {
    const nombre = this.nombreCliente().trim() || this.currentUser()?.nombre || 'Cliente';
    const total = this.totalPedido();
    const codigo = codigoPedido || 'NUEVO';
    const msg = `Hola Luigie's Restaurante! Acabo de hacer un pedido a domicilio ${codigo !== 'NUEVO' ? '#' + codigo : ''} por valor de $${total.toLocaleString('es-CO')} COP a nombre de ${nombre}. Adjunto mi comprobante de pago por transferencia para confirmarlo.`;
    return `https://wa.me/${this.WHATSAPP_SOPORTE_NUMERO}?text=${encodeURIComponent(msg)}`;
  }

  abrirWhatsApp(codigoPedido?: string): void {
    window.open(this.generarUrlWhatsApp(codigoPedido), '_blank', 'noopener,noreferrer');
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
    if (this.enviandoPedido()) return;

    if (this.estadoServicio() && !this.estadoServicio()?.activo) {
      this.snackBar.open(
        `No se puede procesar el pedido. ${this.estadoServicio()?.motivo || 'El restaurante no está recibiendo pedidos a domicilio en este momento.'}`,
        'Entendido',
        { duration: 5000 }
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

    if (!this.direccionEntrega().trim() || this.direccionEntrega().trim().length < 5) {
      this.snackBar.open(
        'Por favor ingresa una dirección de entrega válida (calle, carrera, barrio).',
        'Entendido',
        { duration: 4000 }
      );
      return;
    }

    if (!this.metodoPago()) {
      this.snackBar.open(
        'Por favor selecciona el método de pago.',
        'Entendido',
        { duration: 4000 }
      );
      return;
    }

    let itemsPayload: Array<{
      id_producto: number;
      cantidad: number;
      observacion?: string;
    }> = [];

    let descripcionResumen = '';

    if (this.carrito().length > 0) {
      itemsPayload = this.carrito().map((it) => ({
        id_producto: it.producto.id_producto,
        cantidad: it.cantidad,
        ingredientes_removidos:
          it.ingredientes_removidos && it.ingredientes_removidos.length > 0
            ? it.ingredientes_removidos.join(', ')
            : undefined,
        observacion: it.observacion?.trim() || undefined,
      }));
      descripcionResumen = this.carrito()
        .map((it) => `${it.cantidad}x ${it.producto.nombre}`)
        .join(', ');
    } else if (this.productoSeleccionado()) {
      const prod = this.productoSeleccionado()!;
      itemsPayload = [
        {
          id_producto: prod.id_producto,
          cantidad: this.cantidad(),
          observacion: this.observaciones().trim() || undefined,
        },
      ];
      descripcionResumen = `${this.cantidad()}x ${prod.nombre}`;
    } else {
      this.snackBar.open('No hay productos en el pedido.', 'Cerrar', { duration: 3000 });
      return;
    }

    const clienteNombre = this.nombreCliente().trim();
    const direccion = this.direccionEntrega().trim();
    const notasArray = [
      this.referenciaUbicacion().trim() ? `Ref: ${this.referenciaUbicacion().trim()}` : '',
      this.observaciones().trim() ? `Obs: ${this.observaciones().trim()}` : '',
    ].filter(Boolean);

    const payload: CreateDomicilioPayload = {
      cliente: {
        nombre: clienteNombre,
        telefono: this.telefonoContacto().trim(),
        direccion: direccion,
      },
      items: itemsPayload,
      observacion: notasArray.length > 0 ? notasArray.join(' | ').slice(0, 255) : undefined,
      metodo_pago: this.metodoPago(),
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
          producto: descripcionResumen,
          direccion,
          metodoPago: this.metodoPago(),
        });

        this.vaciarCarrito();
        this.mostrarModalPedido.set(false);

        if (domicilioCreado.id_pedido) {
          try {
            localStorage.setItem(
              'ultimo_pedido_domicilio_id',
              String(domicilioCreado.id_pedido)
            );
          } catch {}
          this.iniciarTrackingPedido(domicilioCreado.id_pedido);
        }

        // Transición a la sección "Mis Pedidos" para no saturar la vista de la carta
        this.vistaActiva.set('mis-pedidos');
        if (this.isAuthenticated()) {
          this.cargarMisPedidos(false);
        }

        this.snackBar.open(
          `¡Pedido #${codigo} recibido! Puedes consultar su progreso en tiempo real en la pestaña Mis Pedidos.`,
          'Ver Progreso',
          { duration: 8000 }
        );
      },
      error: (err) => {
        this.enviandoPedido.set(false);
        const msg =
          err.error?.message ||
          'No fue posible registrar tu pedido. Por favor intenta de nuevo.';
        this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }

  cerrarModalConfirmacion(): void {
    this.pedidoConfirmado.set(null);
  }

  recuperarUltimoPedido(): void {
    try {
      const guardado = localStorage.getItem('ultimo_pedido_domicilio_id');
      if (guardado) {
        this.iniciarTrackingPedido(Number(guardado));
      }
    } catch {}
  }

  iniciarTrackingPedido(id_pedido: number): void {
    if (this.intervaloTracking) {
      clearInterval(this.intervaloTracking);
    }

    const consultar = () => {
      this.domiciliosApi.obtenerPorId(id_pedido).subscribe({
        next: (pedido) => {
          this.pedidoActivoTracking.set(pedido);
          // Actualizar en la lista de mis pedidos si ya está presente
          this.misPedidos.update((lista) =>
            lista.map((p) => (p.id_pedido === pedido.id_pedido ? pedido : p))
          );

          if (
            pedido.etapaOperativa === 'Entregado' ||
            pedido.etapaOperativa === 'Cancelado'
          ) {
            if (this.intervaloTracking) {
              clearInterval(this.intervaloTracking);
              this.intervaloTracking = null;
            }
          }
        },
        error: (err) => {
          if (this.intervaloTracking) {
            clearInterval(this.intervaloTracking);
            this.intervaloTracking = null;
          }
          if (err?.status === 403 || err?.status === 404) {
            this.cerrarTracking();
          }
        },
      });
    };

    consultar();
    this.intervaloTracking = setInterval(consultar, 6000);
  }

  cerrarTracking(): void {
    if (this.intervaloTracking) {
      clearInterval(this.intervaloTracking);
      this.intervaloTracking = null;
    }
    this.pedidoActivoTracking.set(null);
    try {
      localStorage.removeItem('ultimo_pedido_domicilio_id');
    } catch {}
  }

  cerrarSesion(): void {
    this.cerrarTracking();
    this.authService.logout('/cliente');
    this.misPedidos.set([]);
    this.carrito.set([]);
    this.vistaActiva.set('carta');
    this.snackBar.open('Has cerrado sesión correctamente.', 'Entendido', {
      duration: 3000,
    });
  }

  getChipClass(etapa?: string): string {
    switch (etapa) {
      case 'Pendiente':
        return 'chip-pending';
      case 'En Preparación':
        return 'chip-prep';
      case 'En Reparto':
        return 'chip-delivery';
      case 'Entregado':
        return 'chip-delivered';
      case 'Cancelado':
        return 'chip-cancelled';
      default:
        return 'chip-default';
    }
  }

  formatearFechaHora(fecha?: string | Date): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
