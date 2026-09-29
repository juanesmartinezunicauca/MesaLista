import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NewDeliveryDialogComponent } from '../nuevo-domicilio/nuevo-domi-modal';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { Domicilio, EtapaOperativaDomicilio } from '../../../core/models';

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule,
  ],
  templateUrl: './dashboard-domis.html',
  styleUrls: ['./dashboard-domis.scss'],
})
export class DashboardDomisComponent implements OnInit {
  private domiciliosApi = inject(DomiciliosApiService);
  private facturacionApi = inject(FacturacionApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Estados reactivos
  pedidos = signal<Domicilio[]>([]);
  cargando = signal<boolean>(false);
  filtroEstado = signal<string>('Todos');
  busqueda = signal<string>('');
  procesandoId = signal<number | null>(null);

  // Métricas y KPIs de la jornada
  kpis = computed(() => {
    const list = this.pedidos();
    return {
      total: list.length,
      enPreparacion: list.filter((p) => p.etapaOperativa === 'En Preparación').length,
      enReparto: list.filter((p) => p.etapaOperativa === 'En Reparto').length,
      entregados: list.filter((p) => p.etapaOperativa === 'Entregado').length,
    };
  });

  // Lista filtrada y ordenada por hora descendente
  pedidosFiltrados = computed(() => {
    const filtro = this.filtroEstado();
    const query = this.busqueda().trim().toLowerCase();
    let lista = [...this.pedidos()];

    if (filtro !== 'Todos') {
      lista = lista.filter((p) => p.etapaOperativa === filtro);
    }

    if (query) {
      lista = lista.filter((p) => {
        const clienteNom = p.cliente?.nombre?.toLowerCase() || '';
        const clienteTel = p.cliente?.telefono?.toLowerCase() || '';
        const clienteDir = p.cliente?.direccion?.toLowerCase() || '';
        const consecutivo = `#${p.numero_pedido}`;
        return (
          clienteNom.includes(query) ||
          clienteTel.includes(query) ||
          clienteDir.includes(query) ||
          consecutivo.includes(query)
        );
      });
    }

    return lista.sort(
      (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime(),
    );
  });

  ngOnInit(): void {
    this.cargarPedidos();
  }

  cargarPedidos(): void {
    this.cargando.set(true);
    this.domiciliosApi.obtenerTodos().subscribe({
      next: (data) => {
        this.pedidos.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar la lista de domicilios.', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  cambiarFiltro(nuevoFiltro: string): void {
    this.filtroEstado.set(nuevoFiltro);
  }

  crearNuevoPedido(): void {
    const dialogRef = this.dialog.open(NewDeliveryDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado) {
        this.snackBar.open('¡Pedido a domicilio creado y enviado a cocina!', 'OK', {
          duration: 3500,
        });
        this.cargarPedidos();
      }
    });
  }

  despachar(pedido: Domicilio): void {
    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'En Reparto').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(`Pedido #${pedido.numero_pedido} marcado como En Reparto.`, 'OK', {
          duration: 2500,
        });
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al despachar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  regresarAPreparacion(pedido: Domicilio): void {
    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'En Preparación').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
      },
      error: () => {
        this.procesandoId.set(null);
      },
    });
  }

  cobrarYEntregar(pedido: Domicilio, medioPago: 'Efectivo' | 'Tarjeta' | 'Transferencia' = 'Efectivo'): void {
    this.procesandoId.set(pedido.id_pedido);

    const payload = {
      id_pedido: pedido.id_pedido,
      id_cliente: pedido.id_cliente,
      propina: 0,
      observacion: `Cobro domicilio #${pedido.numero_pedido} - Cliente: ${pedido.cliente?.nombre}`,
      pagos: [
        {
          medio_pago: medioPago,
          monto: pedido.totalCalculado,
        },
      ],
    };

    this.facturacionApi.crearFactura(payload).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.snackBar.open(
          `¡Domicilio #${pedido.numero_pedido} cobrado y registrado en caja!`,
          'OK',
          { duration: 3500 },
        );
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al procesar el cobro en caja.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  cancelar(pedido: Domicilio): void {
    const confirmar = confirm(
      `¿Estás seguro de cancelar el pedido a domicilio #${pedido.numero_pedido}? Las cantidades volverán al inventario.`,
    );
    if (!confirmar) return;

    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cancelar(pedido.id_pedido, 'Cancelado desde panel de domicilios').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(`Pedido #${pedido.numero_pedido} cancelado e inventario revertido.`, 'OK', {
          duration: 3000,
        });
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al cancelar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  private actualizarPedidoEnLista(actualizado: Domicilio): void {
    this.pedidos.update((lista) =>
      lista.map((p) => (p.id_pedido === actualizado.id_pedido ? actualizado : p)),
    );
  }

  formatearHora(fecha: string | Date): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
