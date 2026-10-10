import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CajaApiService } from '../../../core/services/api/caja-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { PedidosApiService } from '../../../core/services/api/pedidos-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';

export type HistorialTab = 'caja' | 'facturas' | 'pedidos' | 'domicilios';

export interface ModalEdicionData {
  tipo: 'caja' | 'factura' | 'pedido' | 'domicilio';
  titulo: string;
  subtitulo: string;
  icono: string;
  itemOriginal: any;
  // Campos Turno de Caja
  cajaObservacion?: string;
  // Campos Factura
  facturaPropina?: number;
  facturaMetodoPago?: string;
  facturaObservacion?: string;
  // Campos Pedido Salón
  pedidoEstado?: string;
  pedidoObservacion?: string;
  // Campos Domicilio
  domicilioNombre?: string;
  domicilioEmail?: string;
  domicilioTelefono?: string;
  domicilioDireccion?: string;
  domicilioMetodoPago?: string;
  domicilioObservacion?: string;
}

export interface ModalPeligroData {
  tipo: 'anular_factura' | 'eliminar_factura' | 'eliminar_pedido' | 'eliminar_domicilio';
  titulo: string;
  subtitulo: string;
  mensaje: string;
  item: any;
  motivo?: string;
}

@Component({
  selector: 'app-vista-historial',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './vista-historial.html',
  styleUrl: './vista-historial.scss',
})
export class VistaHistorialComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private cajaApi = inject(CajaApiService);
  private facturacionApi = inject(FacturacionApiService);
  private pedidosApi = inject(PedidosApiService);
  private domiciliosApi = inject(DomiciliosApiService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  // Permisos según rol
  esAdmin = computed(() => this.authService.userRole() === 'administrador');
  esCajero = computed(() => this.authService.userRole() === 'cajero');
  puedeEditar = computed(() => this.esAdmin() || this.esCajero());
  puedeEliminar = computed(() => this.esAdmin());

  tabActiva = signal<HistorialTab>('caja');
  cargando = signal<boolean>(false);
  busqueda = signal<string>('');

  // Datos de cada historial
  turnosCaja = signal<any[]>([]);
  facturas = signal<any[]>([]);
  pedidosSalon = signal<any[]>([]);
  domicilios = signal<any[]>([]);

  // Filtros de fecha opcionales
  fechaFiltro = signal<string>('');

  // Modales de Edición y Eliminación
  modalEdicion = signal<ModalEdicionData | null>(null);
  modalPeligro = signal<ModalPeligroData | null>(null);
  guardandoModal = signal<boolean>(false);

  ngOnInit(): void {
    // Si viene parametro query tab=domicilios
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        const t = params['tab'] as HistorialTab;
        if (['caja', 'facturas', 'pedidos', 'domicilios'].includes(t)) {
          this.tabActiva.set(t);
        }
      }
    });

    this.cargarDatosTab(this.tabActiva());
  }

  cambiarTab(tab: HistorialTab): void {
    this.tabActiva.set(tab);
    this.busqueda.set('');
    this.cargarDatosTab(tab);
  }

  cargarDatosTab(tab: HistorialTab): void {
    this.cargando.set(true);

    switch (tab) {
      case 'caja':
        this.cajaApi.obtenerHistorial(30).subscribe({
          next: (data) => {
            this.turnosCaja.set(data || []);
            this.cargando.set(false);
          },
          error: () => this.handleError('turnos de caja'),
        });
        break;

      case 'facturas':
        this.facturacionApi.obtenerTodas({ fecha: this.fechaFiltro() || undefined }).subscribe({
          next: (data) => {
            this.facturas.set(data || []);
            this.cargando.set(false);
          },
          error: () => this.handleError('facturas'),
        });
        break;

      case 'pedidos':
        this.pedidosApi.obtenerTodos({ tipo: 'salon', fecha: this.fechaFiltro() || undefined }).subscribe({
          next: (data) => {
            this.pedidosSalon.set(data || []);
            this.cargando.set(false);
          },
          error: () => this.handleError('pedidos de salón'),
        });
        break;

      case 'domicilios':
        this.domiciliosApi.obtenerTodos({ fecha: this.fechaFiltro() || undefined }).subscribe({
          next: (data) => {
            this.domicilios.set(data || []);
            this.cargando.set(false);
          },
          error: () => this.handleError('domicilios'),
        });
        break;
    }
  }

  private handleError(recurso: string): void {
    this.cargando.set(false);
    this.snackBar.open(`Error al cargar el historial de ${recurso}`, 'Cerrar', { duration: 3000 });
  }

  // Filtrado reactivo según búsqueda
  turnosCajaFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.turnosCaja();
    return this.turnosCaja().filter(
      (c) =>
        String(c.id_caja).includes(q) ||
        (c.usuarioApertura?.nombre && c.usuarioApertura.nombre.toLowerCase().includes(q)) ||
        (c.usuarioCierre?.nombre && c.usuarioCierre.nombre.toLowerCase().includes(q))
    );
  });

  facturasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.facturas();
    return this.facturas().filter(
      (f) =>
        String(f.id_venta).includes(q) ||
        (f.cliente?.nombre && f.cliente.nombre.toLowerCase().includes(q)) ||
        (f.mesa?.numero && `mesa ${f.mesa.numero}`.includes(q)) ||
        (f.estado && f.estado.toLowerCase().includes(q)) ||
        (f.motivo_anulacion && f.motivo_anulacion.toLowerCase().includes(q)) ||
        (f.pagos && f.pagos.some((p: any) => p.medioPago?.nombre?.toLowerCase().includes(q)))
    );
  });

  pedidosSalonFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.pedidosSalon();
    return this.pedidosSalon().filter(
      (p) =>
        String(p.numero_pedido).includes(q) ||
        (p.mesa?.numero && `mesa ${p.mesa.numero}`.includes(q)) ||
        (p.usuario?.nombre && p.usuario.nombre.toLowerCase().includes(q)) ||
        (p.items && p.items.some((i: any) => i.producto?.nombre?.toLowerCase().includes(q)))
    );
  });

  domiciliosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.domicilios();
    return this.domicilios().filter(
      (d) =>
        String(d.numero_pedido).includes(q) ||
        (d.cliente?.nombre && d.cliente.nombre.toLowerCase().includes(q)) ||
        (d.cliente?.email && d.cliente.email.toLowerCase().includes(q)) ||
        (d.cliente?.telefono && d.cliente.telefono.includes(q)) ||
        (d.cliente?.direccion && d.cliente.direccion.toLowerCase().includes(q)) ||
        (d.estado && d.estado.toLowerCase().includes(q))
    );
  });

  // --- MÉTODOS DE APERTURA DE MODAL DE EDICIÓN ---

  // 1. Turno de Caja (Admin)
  editarObservacionCaja(turno: any): void {
    if (!this.esAdmin()) {
      this.snackBar.open('Solo el super administrador puede editar observaciones de turnos de caja.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalEdicion.set({
      tipo: 'caja',
      titulo: `Editar Turno #CJA-${turno.id_caja}`,
      subtitulo: `Cajero: ${turno.usuario?.nombre || 'Usuario'} • Estado: ${turno.estado}`,
      icono: 'point_of_sale',
      itemOriginal: turno,
      cajaObservacion: turno.observaciones || turno.observacion || '',
    });
  }

  // 2. Factura (Cajero y Admin)
  editarFactura(fac: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar facturas.', 'Entendido', { duration: 3000 });
      return;
    }
    const primerMedio = fac.pagos?.[0]?.medioPago?.nombre || 'Efectivo';
    this.modalEdicion.set({
      tipo: 'factura',
      titulo: `Editar Factura #FAC-${fac.id_venta}`,
      subtitulo: `${fac.mesa ? 'Mesa ' + fac.mesa.numero : 'Domicilio'} • Total: $${(fac.total || fac.valor_total || 0).toLocaleString()}`,
      icono: 'receipt_long',
      itemOriginal: fac,
      facturaPropina: fac.propina || 0,
      facturaMetodoPago: primerMedio,
      facturaObservacion: fac.observacion || '',
    });
  }

  // 3. Pedido de Salón (Cajero y Admin)
  editarPedidoSalon(ped: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar pedidos.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalEdicion.set({
      tipo: 'pedido',
      titulo: `Editar Pedido de Salón #${ped.numero_pedido}`,
      subtitulo: `Mesa ${ped.mesa?.numero || 'N/A'} • Atendido por: ${ped.usuario?.nombre || 'Mesero'}`,
      icono: 'table_restaurant',
      itemOriginal: ped,
      pedidoEstado: ped.estado || 'enviada',
      pedidoObservacion: ped.observacion || '',
    });
  }

  // 4. Domicilio (Cajero y Admin)
  editarDomicilio(dom: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar domicilios.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalEdicion.set({
      tipo: 'domicilio',
      titulo: `Editar Domicilio #${dom.numero_pedido}`,
      subtitulo: `Cliente: ${dom.cliente?.nombre || 'Cliente'} • Total: $${(dom.totalCalculado || dom.factura?.total || 0).toLocaleString()}`,
      icono: 'delivery_dining',
      itemOriginal: dom,
      domicilioNombre: dom.cliente?.nombre || '',
      domicilioEmail: dom.cliente?.email || '',
      domicilioTelefono: dom.cliente?.telefono || '',
      domicilioDireccion: dom.cliente?.direccion || '',
      domicilioMetodoPago: dom.metodo_pago || 'Efectivo',
      domicilioObservacion: dom.observacion || '',
    });
  }

  // --- MÉTODOS DE APERTURA DE MODAL DE ACCIONES PELIGROSAS (ANULACIÓN/ELIMINACIÓN) ---

  anularFactura(fac: any): void {
    if (fac.estado === 'anulada') {
      this.snackBar.open(`La factura #FAC-${fac.id_venta} ya está anulada.`, 'Entendido', { duration: 3000 });
      return;
    }
    this.modalPeligro.set({
      tipo: 'anular_factura',
      titulo: `¿Anular Factura #FAC-${fac.id_venta}?`,
      subtitulo: `Total: $${(fac.total || fac.valor_total || 0).toLocaleString()} • Registrada por: ${fac.usuario?.nombre || 'Caja'}`,
      mensaje: 'Esta acción anulará la factura contablemente (sin alterar el consecutivo numérico), la descontará del arqueo del turno de caja activo y devolverá los ingredientes o productos al inventario.',
      item: fac,
      motivo: 'Error en digitación o anulación del servicio',
    });
  }

  eliminarFactura(fac: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede anular o eliminar registros de facturas.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalPeligro.set({
      tipo: 'eliminar_factura',
      titulo: `¿Eliminar Registro #FAC-${fac.id_venta}?`,
      subtitulo: `Total: $${(fac.total || fac.valor_total || 0).toLocaleString()} • Estado actual: ${fac.estado}`,
      mensaje: 'Se anulará la factura en el sistema y se ajustará el saldo contable correspondiente en caja.',
      item: fac,
    });
  }

  eliminarPedidoSalon(ped: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede eliminar pedidos del historial.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalPeligro.set({
      tipo: 'eliminar_pedido',
      titulo: `¿Eliminar Pedido #${ped.numero_pedido}?`,
      subtitulo: `Mesa ${ped.mesa?.numero || 'N/A'} • ${ped.items?.length || 0} ítems registrados`,
      mensaje: 'Se removerán permanentemente el pedido y todos sus productos del historial operativo. Si la mesa estaba ocupada por esta comanda, quedará liberada.',
      item: ped,
    });
  }

  eliminarDomicilio(dom: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede eliminar domicilios del historial.', 'Entendido', { duration: 3000 });
      return;
    }
    this.modalPeligro.set({
      tipo: 'eliminar_domicilio',
      titulo: `¿Eliminar Domicilio #${dom.numero_pedido}?`,
      subtitulo: `Cliente: ${dom.cliente?.nombre || 'Cliente'} • Dirección: ${dom.cliente?.direccion || 'N/A'}`,
      mensaje: 'El registro de entrega de este domicilio se removerá permanentemente del historial. Los comprobantes y facturas de caja permanecerán intactos.',
      item: dom,
    });
  }

  // --- ACCIONES DE GUARDADO Y CIERRE DE MODALES ---

  guardarModalEdicion(): void {
    const m = this.modalEdicion();
    if (!m) return;

    this.guardandoModal.set(true);

    if (m.tipo === 'caja') {
      this.cajaApi.actualizarObservacionTurno(m.itemOriginal.id_caja, m.cajaObservacion?.trim() || '').subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Observación del Turno #CJA-${m.itemOriginal.id_caja} actualizada exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('caja');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al actualizar observación de caja.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    } else if (m.tipo === 'factura') {
      const fac = m.itemOriginal;
      const valorBase = (fac.total || fac.valor_total || 0) - (fac.propina || 0);
      const propinaNum = Number(m.facturaPropina) >= 0 ? Number(m.facturaPropina) : 0;
      const nuevoTotal = valorBase + propinaNum;

      const payload: any = {
        observacion: m.facturaObservacion?.trim() || undefined,
        propina: propinaNum,
      };
      if (m.facturaMetodoPago) {
        payload.pagos = [
          {
            medio_pago: m.facturaMetodoPago,
            monto: nuevoTotal,
          },
        ];
      }

      this.facturacionApi.actualizarFactura(fac.id_venta, payload).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Factura #FAC-${fac.id_venta} actualizada exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('facturas');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al editar factura.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    } else if (m.tipo === 'pedido') {
      const ped = m.itemOriginal;
      this.pedidosApi.actualizarPedido(ped.id_pedido, {
        observacion: m.pedidoObservacion?.trim() || undefined,
        estado: m.pedidoEstado,
      }).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Pedido #${ped.numero_pedido} actualizado exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('pedidos');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al actualizar el pedido.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    } else if (m.tipo === 'domicilio') {
      const dom = m.itemOriginal;
      this.domiciliosApi.actualizarDomicilio(dom.id_pedido, {
        cliente_nombre: m.domicilioNombre?.trim(),
        cliente_email: m.domicilioEmail?.trim() || undefined,
        cliente_telefono: m.domicilioTelefono?.trim(),
        cliente_direccion: m.domicilioDireccion?.trim(),
        metodo_pago: m.domicilioMetodoPago,
        observacion: m.domicilioObservacion?.trim(),
      }).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Domicilio #${dom.numero_pedido} actualizado exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('domicilios');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al actualizar domicilio.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    }
  }

  confirmarModalEliminacion(): void {
    const p = this.modalPeligro();
    if (!p) return;

    this.guardandoModal.set(true);

    if (p.tipo === 'anular_factura') {
      const motivo = p.motivo?.trim() || 'Anulación solicitada desde terminal';
      this.facturacionApi.anularFactura(p.item.id_venta, motivo).subscribe({
        next: (res) => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(res.mensaje || `Factura #FAC-${p.item.id_venta} anulada exitosamente.`, 'OK', { duration: 4000 });
          this.cargarDatosTab('facturas');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al anular la factura.';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
        },
      });
    } else if (p.tipo === 'eliminar_factura') {
      this.facturacionApi.eliminarFactura(p.item.id_venta).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Factura #FAC-${p.item.id_venta} eliminada exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('facturas');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al eliminar factura.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    } else if (p.tipo === 'eliminar_pedido') {
      this.pedidosApi.eliminarPedido(p.item.id_pedido).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Pedido #${p.item.numero_pedido} eliminado exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('pedidos');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al eliminar el pedido.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    } else if (p.tipo === 'eliminar_domicilio') {
      this.domiciliosApi.eliminar(p.item.id_pedido).subscribe({
        next: () => {
          this.guardandoModal.set(false);
          this.cerrarModal();
          this.snackBar.open(`Domicilio #${p.item.numero_pedido} eliminado exitosamente.`, 'OK', { duration: 3000 });
          this.cargarDatosTab('domicilios');
        },
        error: (err) => {
          this.guardandoModal.set(false);
          const msg = err.error?.message || 'Error al eliminar domicilio.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
    }
  }

  cerrarModal(): void {
    if (this.guardandoModal()) return;
    this.modalEdicion.set(null);
    this.modalPeligro.set(null);
  }
}
