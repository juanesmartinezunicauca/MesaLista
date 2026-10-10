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

// Servicios
import { CajaApiService } from '../../../core/services/api/caja-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { PedidosApiService } from '../../../core/services/api/pedidos-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';

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
  private snackBar = inject(MatSnackBar);

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
}
