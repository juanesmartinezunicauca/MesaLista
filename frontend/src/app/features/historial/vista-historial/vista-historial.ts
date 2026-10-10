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

  anularFactura(fac: any): void {
    if (fac.estado === 'anulada') {
      this.snackBar.open(`La factura #FAC-${fac.id_venta} ya está anulada.`, 'Entendido', { duration: 3000 });
      return;
    }

    const motivo = prompt(
      `Ingresa el motivo justificado de anulación para la factura #FAC-${fac.id_venta}:`,
      'Error en método de pago o cancelación del servicio',
    );

    if (motivo === null) return;

    if (!motivo.trim()) {
      this.snackBar.open('El motivo de anulación es obligatorio por auditoría.', 'Cerrar', { duration: 3500 });
      return;
    }

    this.cargando.set(true);
    this.facturacionApi.anularFactura(fac.id_venta, motivo.trim()).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.snackBar.open(
          res.mensaje || `Factura #FAC-${fac.id_venta} anulada exitosamente.`,
          'OK',
          { duration: 4000 },
        );
        this.cargarDatosTab('facturas');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al anular la factura.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4500 });
      },
    });
  }

  // --- MÉTODOS DE EDICIÓN Y ELIMINACIÓN SEGÚN ROLES ---

  // 1. Turnos de Caja (Solo Admin puede editar observación. La caja NO se puede eliminar)
  editarObservacionCaja(turno: any): void {
    if (!this.esAdmin()) {
      this.snackBar.open('Solo el super administrador puede editar observaciones de turnos de caja.', 'Entendido', { duration: 3000 });
      return;
    }

    const nuevaObs = prompt(
      `Editar observación del Turno #CJA-${turno.id_caja}:`,
      turno.observacion || ''
    );
    if (nuevaObs === null) return;

    this.cargando.set(true);
    this.cajaApi.actualizarObservacionTurno(turno.id_caja, nuevaObs.trim()).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Observación del Turno #CJA-${turno.id_caja} actualizada.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('caja');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al actualizar observación de caja.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  // 2. Facturas (Cajero y Admin pueden editar; solo Admin puede eliminar)
  editarFactura(fac: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar facturas.', 'Entendido', { duration: 3000 });
      return;
    }

    const nuevaObs = prompt(
      `Editar observación de la Factura #FAC-${fac.id_venta}:`,
      fac.observacion || ''
    );
    if (nuevaObs === null) return;

    const propinaStr = prompt(
      `Propina registrada (actual: $${fac.propina || 0}):`,
      String(fac.propina || 0)
    );
    if (propinaStr === null) return;

    const propinaNum = Number(propinaStr) >= 0 ? Number(propinaStr) : (fac.propina || 0);

    this.cargando.set(true);
    this.facturacionApi.actualizarFactura(fac.id_venta, {
      observacion: nuevaObs.trim(),
      propina: propinaNum,
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Factura #FAC-${fac.id_venta} editada exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('facturas');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al editar factura.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  eliminarFactura(fac: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede eliminar registros de facturas.', 'Entendido', { duration: 3000 });
      return;
    }

    const confirmar = confirm(
      `¿Estás seguro de eliminar permanentemente la Factura #FAC-${fac.id_venta}?`
    );
    if (!confirmar) return;

    this.cargando.set(true);
    this.facturacionApi.eliminarFactura(fac.id_venta).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Factura #FAC-${fac.id_venta} eliminada exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('facturas');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al eliminar factura.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  // 3. Pedidos de Salón (Cajero y Admin pueden editar; solo Admin puede eliminar)
  editarPedidoSalon(ped: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar pedidos.', 'Entendido', { duration: 3000 });
      return;
    }

    const nuevaObs = prompt(
      `Editar observación del Pedido #${ped.numero_pedido}:`,
      ped.observacion || ''
    );
    if (nuevaObs === null) return;

    const nuevoEstado = prompt(
      `Estado del pedido (enviada / cerrada / cancelada):`,
      ped.estado || 'enviada'
    );
    if (nuevoEstado === null) return;

    this.cargando.set(true);
    this.pedidosApi.actualizarPedido(ped.id_pedido, {
      observacion: nuevaObs.trim(),
      estado: nuevoEstado.trim().toLowerCase(),
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Pedido #${ped.numero_pedido} actualizado exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('pedidos');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al actualizar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  eliminarPedidoSalon(ped: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede eliminar pedidos del historial.', 'Entendido', { duration: 3000 });
      return;
    }

    const confirmar = confirm(
      `¿Estás seguro de eliminar el Pedido #${ped.numero_pedido} de mesa ${ped.mesa?.numero || ''}? Se removerán todos sus productos asociados.`
    );
    if (!confirmar) return;

    this.cargando.set(true);
    this.pedidosApi.eliminarPedido(ped.id_pedido).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Pedido #${ped.numero_pedido} eliminado exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('pedidos');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al eliminar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  // 4. Domicilios (Cajero y Admin pueden editar; solo Admin puede eliminar)
  editarDomicilio(dom: any): void {
    if (!this.puedeEditar()) {
      this.snackBar.open('No tienes permisos para editar domicilios.', 'Entendido', { duration: 3000 });
      return;
    }

    const nombre = prompt('Nombre del cliente:', dom.cliente?.nombre || '');
    if (nombre === null) return;

    const telefono = prompt('Teléfono del cliente:', dom.cliente?.telefono || '');
    if (telefono === null) return;

    const direccion = prompt('Dirección de entrega:', dom.cliente?.direccion || '');
    if (direccion === null) return;

    const metodo = prompt('Método de pago (Efectivo / Transferencia):', dom.metodo_pago || 'Efectivo');
    if (metodo === null) return;

    const obs = prompt('Observación / nota:', dom.observacion || '');
    if (obs === null) return;

    this.cargando.set(true);
    this.domiciliosApi.actualizarDomicilio(dom.id_pedido, {
      cliente_nombre: nombre.trim(),
      cliente_telefono: telefono.trim(),
      cliente_direccion: direccion.trim(),
      metodo_pago: metodo.trim(),
      observacion: obs.trim(),
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Domicilio #${dom.numero_pedido} actualizado exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('domicilios');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al actualizar domicilio.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  eliminarDomicilio(dom: any): void {
    if (!this.puedeEliminar()) {
      this.snackBar.open('Solo el super administrador puede eliminar domicilios del historial.', 'Entendido', { duration: 3000 });
      return;
    }

    const confirmar = confirm(
      `¿Estás seguro de eliminar el Domicilio #${dom.numero_pedido} (${dom.cliente?.nombre || 'Cliente'}) del historial?`
    );
    if (!confirmar) return;

    this.cargando.set(true);
    this.domiciliosApi.eliminar(dom.id_pedido).subscribe({
      next: () => {
        this.cargando.set(false);
        this.snackBar.open(`Domicilio #${dom.numero_pedido} eliminado exitosamente.`, 'OK', { duration: 3000 });
        this.cargarDatosTab('domicilios');
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al eliminar domicilio.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }
}
