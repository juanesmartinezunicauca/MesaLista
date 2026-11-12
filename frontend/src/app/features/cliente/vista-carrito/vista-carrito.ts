import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Servicios y Modelos
import { CarritoService, CartItem } from '../../../core/services/carrito/carrito.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  CreateDomicilioPayload,
  ZONAS_DOMICILIO_POPAYAN,
  ZonaTarifaPopayan,
} from '../../../core/models/domicilio.model';

@Component({
  selector: 'app-vista-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './vista-carrito.html',
  styleUrl: './vista-carrito.scss',
})
export class VistaCarritoComponent implements OnInit {
  public carritoService = inject(CarritoService);
  private domiciliosApi = inject(DomiciliosApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Teléfono oficial de WhatsApp para transferencias
  readonly WHATSAPP_SOPORTE_DISPLAY = '+57 312 345 6789';
  readonly WHATSAPP_NUMERO_CLEAN = '573123456789';

  // Estado del usuario autenticado
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Formulario de entrega
  nombreCliente = signal<string>('');
  telefonoContacto = signal<string>('');
  direccionEntrega = signal<string>('');
  referenciaUbicacion = signal<string>('');
  observaciones = signal<string>('');
  metodoPago = signal<'Efectivo' | 'Transferencia'>('Efectivo');

  // Zonificación de Popayán para tarifas de domicilio
  readonly zonasPopayan = ZONAS_DOMICILIO_POPAYAN;
  zonaSeleccionada = signal<ZonaTarifaPopayan>(this.zonasPopayan[0]);
  costoEnvio = computed<number>(() => this.zonaSeleccionada().tarifa);
  totalConEnvio = computed<number>(() => this.carritoService.totalPrecio() + this.costoEnvio());

  cambiarZona(zonaId: string): void {
    const found = this.zonasPopayan.find((z) => z.id === zonaId);
    if (found) {
      this.zonaSeleccionada.set(found);
    }
  }

  onNombreInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    input.value = clean;
    this.nombreCliente.set(clean);
  }

  onTelefonoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = clean;
    this.telefonoContacto.set(clean);
  }

  // Estado del envío
  enviandoPedido = signal<boolean>(false);
  pedidoConfirmado = signal<{
    codigo: string;
    total: number;
    direccion: string;
    metodoPago: string;
  } | null>(null);

  // MODAL DE PERSONALIZACIÓN DENTRO DEL CARRITO
  itemEnEdicion = signal<{ item: CartItem; index: number } | null>(null);
  ingredientesSeleccionados = signal<string[]>([]);
  observacionItem = signal<string>('');

  ngOnInit(): void {
    // Autocompletar datos del usuario si ha iniciado sesión
    const user = this.currentUser();
    if (user) {
      if (user.nombre) this.nombreCliente.set(user.nombre);
    }
  }

  // ================================================================
  // GESTIÓN DEL MODAL DE PERSONALIZACIÓN DENTRO DEL CARRITO
  // ================================================================

  /**
   * Abre el modal para personalizar los ingredientes y notas de un ítem del carrito
   */
  abrirPersonalizacion(item: CartItem, index: number): void {
    this.itemEnEdicion.set({ item, index });
    const todosIngredientes = item.producto.ingredientes_removibles || [];
    const removidos = item.ingredientes_removidos || [];

    // Los seleccionados (incluidos) son los que NO están en la lista de removidos
    const incluidos = todosIngredientes.filter((ing) => !removidos.includes(ing));
    this.ingredientesSeleccionados.set(incluidos);
    this.observacionItem.set(item.observacion || '');
  }

  cerrarPersonalizacion(): void {
    this.itemEnEdicion.set(null);
  }

  toggleIngrediente(ing: string): void {
    const list = this.ingredientesSeleccionados();
    if (list.includes(ing)) {
      this.ingredientesSeleccionados.set(list.filter((i) => i !== ing));
    } else {
      this.ingredientesSeleccionados.set([...list, ing]);
    }
  }

  guardarPersonalizacion(): void {
    const edicion = this.itemEnEdicion();
    if (!edicion) return;

    const prod = edicion.item.producto;
    const todos = prod.ingredientes_removibles || [];

    // Los removidos son los que NO están incluidos
    const removidos = todos.filter(
      (ing) => !this.ingredientesSeleccionados().includes(ing)
    );

    this.carritoService.actualizarPersonalizacion(
      edicion.index,
      removidos,
      this.observacionItem()
    );

    this.itemEnEdicion.set(null);
    this.snackBar.open(
      `¡Personalización de "${prod.nombre}" actualizada en tu carrito!`,
      'Entendido',
      { duration: 3000 }
    );
  }

  // ================================================================
  // ACCIONES DEL CARRITO
  // ================================================================

  incrementar(index: number): void {
    this.carritoService.incrementar(index);
  }

  decrementar(index: number): void {
    this.carritoService.decrementar(index);
  }

  eliminar(index: number): void {
    this.carritoService.eliminar(index);
    this.snackBar.open('Plato eliminado del carrito.', 'Cerrar', { duration: 2500 });
  }

  vaciar(): void {
    if (confirm('¿Deseas vaciar todos los platos de tu carrito?')) {
      this.carritoService.vaciarCarrito();
      this.snackBar.open('El carrito ha sido vaciado.', 'Cerrar', { duration: 2500 });
    }
  }

  volverALaCarta(): void {
    this.router.navigate(['/cliente']);
  }

  // ================================================================
  // CONFIRMACIÓN Y ENVÍO DEL PEDIDO A DOMICILIO
  // ================================================================

  confirmarPedido(): void {
    if (this.carritoService.carrito().length === 0) {
      this.snackBar.open('Tu carrito está vacío. Agrega platos para ordenar.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    const nombre = this.nombreCliente().trim();
    const tel = this.telefonoContacto().trim();
    const dir = this.direccionEntrega().trim();

    if (!nombre) {
      this.snackBar.open('Por favor ingresa tu nombre completo.', 'Cerrar', { duration: 3500 });
      return;
    }

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{2,100}$/.test(nombre)) {
      this.snackBar.open('El nombre solo debe contener letras y espacios (sin números ni símbolos especiales).', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    if (!tel) {
      this.snackBar.open('Por favor ingresa tu número de celular de contacto.', 'Cerrar', { duration: 3500 });
      return;
    }

    if (!/^[0-9]{10}$/.test(tel)) {
      this.snackBar.open('El teléfono celular debe tener exactamente 10 dígitos numéricos (ej. 3123456789).', 'Cerrar', {
        duration: 4500,
      });
      return;
    }

    if (!dir || dir.length < 5) {
      this.snackBar.open('Por favor ingresa una dirección de entrega completa (mínimo 5 caracteres).', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    // Armar items para la API
    const itemsPayload = this.carritoService.carrito().map((it) => ({
      id_producto: it.producto.id_producto,
      cantidad: it.cantidad,
      ingredientes_removidos:
        it.ingredientes_removidos && it.ingredientes_removidos.length > 0
          ? it.ingredientes_removidos.join(', ')
          : undefined,
      observacion: it.observacion,
    }));

    const zona = this.zonaSeleccionada();
    const zonaCorta = zona.nombre.includes('(')
      ? zona.nombre.split('(')[0].trim()
      : zona.nombre.split(':')[0].trim();

    // Combinar dirección, zona y referencia
    let direccionCompleta = `${dir} [${zonaCorta}]`;
    if (this.referenciaUbicacion().trim()) {
      direccionCompleta += ` (${this.referenciaUbicacion().trim()})`;
    }

    const payload: CreateDomicilioPayload = {
      cliente: {
        nombre,
        telefono: tel,
        direccion: direccionCompleta,
        email: this.currentUser()?.email || undefined,
      },
      items: itemsPayload,
      observacion: this.observaciones().trim() || undefined,
      metodo_pago: this.metodoPago(),
      costo_envio: this.costoEnvio(),
      zona_entrega: zona.nombre,
    };

    this.enviandoPedido.set(true);

    this.domiciliosApi.crear(payload).subscribe({
      next: (domicilioCreado) => {
        this.enviandoPedido.set(false);
        const codigo = domicilioCreado?.numero_pedido
          ? `DOM-${domicilioCreado.numero_pedido}`
          : 'CONFIRMADO';

        const totalCalculado = Number(domicilioCreado?.totalCalculado || this.totalConEnvio());

        // Guardar para seguimiento en tiempo real
        try {
          if (domicilioCreado?.id_pedido) {
            localStorage.setItem(
              'ultimo_pedido_domicilio_id',
              String(domicilioCreado.id_pedido)
            );
          }
        } catch {}

        // Vaciar el carrito
        this.carritoService.vaciarCarrito();

        this.pedidoConfirmado.set({
          codigo,
          total: totalCalculado,
          direccion: direccionCompleta,
          metodoPago: this.metodoPago(),
        });

        this.snackBar.open(
          `¡Pedido #${codigo} recibido con éxito! Redirigiendo al seguimiento...`,
          'Ver Progreso',
          { duration: 6000 }
        );
      },
      error: (err) => {
        this.enviandoPedido.set(false);
        const msg =
          err.error?.message ||
          'No fue posible registrar tu pedido. Por favor intenta de nuevo o comunícate con el restaurante.';
        this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }

  cerrarModalConfirmacion(): void {
    this.pedidoConfirmado.set(null);
    this.router.navigate(['/cliente'], { queryParams: { tab: 'mis-pedidos' } });
  }

  generarUrlWhatsApp(codigo?: string): string {
    const cod = codigo || 'PEDIDO';
    const total = this.totalConEnvio();
    const texto = `Hola Luigie's Restaurante, adjunto mi comprobante de transferencia para el pedido #${cod} por valor de $${total.toLocaleString('es-CO')} COP (incluye envío de $${this.costoEnvio().toLocaleString('es-CO')} COP para ${this.zonaSeleccionada().nombre}).`;
    return `https://wa.me/${this.WHATSAPP_NUMERO_CLEAN}?text=${encodeURIComponent(texto)}`;
  }
}
