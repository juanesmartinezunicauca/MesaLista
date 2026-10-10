import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
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
import { DetalleDomiDialogComponent } from '../detalle-domicilio/detalle-domi-dialog';
import { FacturaDialogComponent } from '../../mesas/dialogs/factura-dialog';
import { HistorialFacturasDialogComponent } from '../../../shared/components/historial-facturas/historial-facturas-dialog';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { Domicilio, EstadoServicioDomicilio } from '../../../core/models';

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
export class DashboardDomisComponent implements OnInit, OnDestroy {
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
  estadoServicio = signal<EstadoServicioDomicilio | null>(null);

  private pollingTimer: any = null;

  // Métricas y KPIs de la jornada
  kpis = computed(() => {
    const list = this.pedidos();
    return {
      total: list.length,
      pendientes: list.filter((p) => p.etapaOperativa === 'Pendiente').length,
      enPreparacion: list.filter((p) => p.etapaOperativa === 'En Preparación').length,
      enReparto: list.filter((p) => p.etapaOperativa === 'En Reparto').length,
      entregados: list.filter((p) => p.etapaOperativa === 'Entregado').length,
      historial: list.filter(
        (p) => p.etapaOperativa === 'Entregado' || p.etapaOperativa === 'Cancelado'
      ).length,
    };
  });

  // Lista filtrada y ordenada por hora descendente
  pedidosFiltrados = computed(() => {
    const filtro = this.filtroEstado();
    const query = this.busqueda().trim().toLowerCase();
    let lista = [...this.pedidos()];

    if (filtro === 'Pendientes') {
      lista = lista.filter((p) => p.etapaOperativa === 'Pendiente');
    } else if (filtro === 'Historial') {
      lista = lista.filter(
        (p) => p.etapaOperativa === 'Entregado' || p.etapaOperativa === 'Cancelado'
      );
    } else if (filtro !== 'Todos') {
      lista = lista.filter((p) => p.etapaOperativa === filtro);
    }

    if (query) {
      lista = lista.filter((p) => {
        const clienteNom = p.cliente?.nombre?.toLowerCase() || '';
        const clienteTel = p.cliente?.telefono?.toLowerCase() || '';
        const clienteDir = p.cliente?.direccion?.toLowerCase() || '';
        const clienteEmail = p.cliente?.email?.toLowerCase() || '';
        const consecutivo = `#${p.numero_pedido}`;
        return (
          clienteNom.includes(query) ||
          clienteTel.includes(query) ||
          clienteDir.includes(query) ||
          clienteEmail.includes(query) ||
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
    this.cargarEstadoServicio();
    // Polling reactivo cada 12 segundos para recibir pedidos del cliente en tiempo real
    this.pollingTimer = setInterval(() => {
      this.cargarPedidos(false);
      this.cargarEstadoServicio();
    }, 12000);
  }

  ngOnDestroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  }

  cargarPedidos(mostrarSpinner = true): void {
    if (mostrarSpinner) this.cargando.set(true);
    this.domiciliosApi.obtenerTodos().subscribe({
      next: (data) => {
        this.pedidos.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        if (mostrarSpinner) {
          this.snackBar.open('Error al cargar la lista de domicilios.', 'Cerrar', {
            duration: 3000,
          });
        }
      },
    });
  }

  cargarEstadoServicio(): void {
    this.domiciliosApi.obtenerEstadoServicio().subscribe({
      next: (estado) => this.estadoServicio.set(estado),
      error: () => {},
    });
  }

  toggleRecepcionDomicilios(): void {
    const actual = this.estadoServicio()?.recibiendoDomicilios ?? true;
    const nuevo = !actual;
    let motivo: string | undefined = undefined;

    if (!nuevo) {
      const inputMotivo = prompt(
        '¿Deseas pausar la recepción de domicilios? Opcionalmente escribe un mensaje para los clientes (ej. Alta demanda o Cocina ocupada):',
        'Pausa temporal por alta demanda'
      );
      if (inputMotivo === null) return;
      motivo = inputMotivo.trim();
    }

    this.domiciliosApi.cambiarRecepcionDomicilios(nuevo, motivo).subscribe({
      next: (resp) => {
        this.estadoServicio.set(resp);
        this.snackBar.open(
          nuevo
            ? '¡Recepción de domicilios activada!'
            : 'Recepción de domicilios pausada temporalmente.',
          'OK',
          { duration: 3500 }
        );
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al actualizar estado del servicio.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      },
    });
  }

  abrirDetalle(pedido: Domicilio): void {
    const dialogRef = this.dialog.open(DetalleDomiDialogComponent, {
      data: { pedido },
      width: '780px',
      maxWidth: '95vw',
      maxHeight: '92vh',
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (!res || !res.accion) return;
      switch (res.accion) {
        case 'aceptar':
          this.aceptarPedido(pedido);
          break;
        case 'rechazar':
          this.rechazarPedido(pedido);
          break;
        case 'despachar':
        case 'reasignar_repartidor':
          this.solicitarDespachoConRepartidor(pedido);
          break;
        case 'facturar':
          this.facturarDomicilio(pedido);
          break;
        case 'cerrar_pedido':
          this.cerrarDomicilio(pedido);
          break;
      }
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
        this.snackBar.open('¡Pedido a domicilio creado!', 'OK', {
          duration: 3500,
        });
        this.cargarPedidos();
      }
    });
  }

  // 1. Aceptar pedido recibido del cliente y enviarlo a cocina
  aceptarPedido(pedido: Domicilio): void {
    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'Aceptar').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(
          `¡Pedido #${pedido.numero_pedido} aceptado y enviado a Cocina!`,
          'OK',
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al aceptar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  // 2. Rechazar pedido recibido del cliente
  rechazarPedido(pedido: Domicilio): void {
    const motivo = prompt(
      `¿Deseas rechazar el pedido #${pedido.numero_pedido}? Motivo del rechazo:`,
      'Sin disponibilidad de productos'
    );
    if (motivo === null) return;

    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'Rechazar', motivo).subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(
          `Pedido #${pedido.numero_pedido} rechazado y cancelado.`,
          'OK',
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al rechazar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  // 3. Despachar comanda a reparto con nombre y teléfono de domiciliario
  despachar(pedido: Domicilio, nombreRepartidor?: string, telRepartidor?: string): void {
    this.procesandoId.set(pedido.id_pedido);
    const call$ = (nombreRepartidor || telRepartidor)
      ? this.domiciliosApi.cambiarEstado(
          pedido.id_pedido,
          'En Reparto',
          undefined,
          nombreRepartidor,
          telRepartidor
        )
      : this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'En Reparto');

    call$.subscribe({
        next: (actualizado) => {
          this.procesandoId.set(null);
          this.actualizarPedidoEnLista(actualizado);
          this.snackBar.open(
            `Pedido #${pedido.numero_pedido} despachado a reparto${
              nombreRepartidor ? ' con ' + nombreRepartidor : ''
            }.`,
            'OK',
            { duration: 3000 }
          );
        },
        error: (err) => {
          this.procesandoId.set(null);
          const msg = err.error?.message || 'Error al despachar el pedido.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
        },
      });
  }

  solicitarDespachoConRepartidor(pedido: Domicilio): void {
    const nombre = prompt(
      `Nombre del domiciliario para pedido #${pedido.numero_pedido}:`,
      pedido.repartidor?.nombre || ''
    );
    if (nombre === null) return;

    const telefono = prompt(
      `Teléfono o número del domiciliario:`,
      pedido.repartidor?.telefono || ''
    );
    if (telefono === null) return;

    this.despachar(pedido, nombre.trim(), telefono.trim());
  }

  regresarAPreparacion(pedido: Domicilio): void {
    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'En Preparación').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(
          `Pedido #${pedido.numero_pedido} regresado a Cocina.`,
          'OK',
          { duration: 2500 }
        );
      },
      error: () => {
        this.procesandoId.set(null);
      },
    });
  }

  // 4. Facturación con selección de medios de pago SIN cerrar el pedido
  facturarDomicilio(pedido: Domicilio): void {
    const dialogRef = this.dialog.open(FacturaDialogComponent, {
      data: { pedido },
      width: '480px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado?.cobrado) {
        const pagosPayload = (resultado.pagos || []).map((p: any) => ({
          medio_pago:
            p.metodo === 'efectivo'
              ? 'Efectivo'
              : p.metodo === 'tarjeta'
              ? 'Tarjeta'
              : 'Transferencia',
          monto: p.monto,
        }));

        this.procesandoId.set(pedido.id_pedido);

        // Si ya cuenta con factura previa, actualizar la misma en caja en lugar de duplicar
        if (pedido.id_factura) {
          this.facturacionApi
            .actualizarFactura(pedido.id_factura, {
              propina: resultado.propina,
              pagos: pagosPayload,
            })
            .subscribe({
              next: () => {
                this.procesandoId.set(null);
                this.snackBar.open(
                  `¡Factura #FAC-${pedido.id_factura} actualizada exitosamente en caja!`,
                  'OK',
                  { duration: 4000 }
                );
                this.cargarPedidos();
              },
              error: (err) => {
                this.procesandoId.set(null);
                const msg = err.error?.message || 'Error al actualizar la factura.';
                this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
              },
            });
          return;
        }

        this.facturacionApi
          .crearFactura({
            id_pedido: pedido.id_pedido,
            id_cliente: pedido.id_cliente,
            propina: resultado.propina,
            observacion: `Domicilio #${pedido.numero_pedido} - Cliente: ${pedido.cliente?.nombre}`,
            pagos: pagosPayload,
            cerrar_pedido: false, // NO cierra el pedido
          })
          .subscribe({
            next: (factura) => {
              this.procesandoId.set(null);
              this.snackBar.open(
                `¡Factura #FAC-${factura.id_venta} registrada en caja! El pedido sigue activo hasta ser entregado.`,
                'OK',
                { duration: 4000 }
              );
              this.cargarPedidos();
            },
            error: (err) => {
              this.procesandoId.set(null);
              const msg = err.error?.message || 'Error al procesar la factura.';
              this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
            },
          });
      }
    });
  }

  // 5. Cerrar pedido y enviarlo a historial
  cerrarDomicilio(pedido: Domicilio): void {
    if (!pedido.id_factura) {
      const cobrar = confirm(
        `El pedido #${pedido.numero_pedido} aún no ha sido facturado ni cobrado en caja.\n\n¿Deseas registrar su factura de cobro en este momento para poder marcarlo como entregado?`
      );
      if (cobrar) {
        this.facturarDomicilio(pedido);
      } else {
        this.snackBar.open(
          'Por control contable, todo domicilio debe ser facturado en caja antes de cerrarse.',
          'Entendido',
          { duration: 4000 }
        );
      }
      return;
    }

    const confirmar = confirm(
      `¿Confirmar que el pedido #${pedido.numero_pedido} fue entregado? Se cerrará y pasará al Historial.`
    );
    if (!confirmar) return;

    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.cambiarEstado(pedido.id_pedido, 'Entregado').subscribe({
      next: (actualizado) => {
        this.procesandoId.set(null);
        this.actualizarPedidoEnLista(actualizado);
        this.snackBar.open(
          `Pedido #${pedido.numero_pedido} entregado y archivado en Historial.`,
          'OK',
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al cerrar el pedido.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
    });
  }

  // 6. Abrir Historial de Facturación y edición de facturas
  abrirHistorialFacturas(): void {
    this.dialog.open(HistorialFacturasDialogComponent, {
      width: '840px',
      maxWidth: '95vw',
    });
  }

  // Cobro rápido compatible hacia atrás
  cobrarYEntregar(
    pedido: Domicilio,
    medioPago: 'Efectivo' | 'Tarjeta' | 'Transferencia' = 'Efectivo'
  ): void {
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
      cerrar_pedido: false,
    };

    this.facturacionApi.crearFactura(payload).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.snackBar.open(
          `¡Domicilio #${pedido.numero_pedido} facturado en caja!`,
          'OK',
          { duration: 3500 }
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
      `¿Estás seguro de cancelar el pedido a domicilio #${pedido.numero_pedido}? Las cantidades volverán al inventario.`
    );
    if (!confirmar) return;

    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi
      .cancelar(pedido.id_pedido, 'Cancelado desde panel de domicilios')
      .subscribe({
        next: (actualizado) => {
          this.procesandoId.set(null);
          this.actualizarPedidoEnLista(actualizado);
          this.snackBar.open(
            `Pedido #${pedido.numero_pedido} cancelado e inventario revertido.`,
            'OK',
            { duration: 3000 }
          );
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
      lista.map((p) => (p.id_pedido === actualizado.id_pedido ? actualizado : p))
    );
  }

  limpiarHistorial(): void {
    const confirmar = confirm(
      '¿Estás seguro de que deseas limpiar todo el historial de domicilios cerrados y cancelados? Esta acción eliminará estos pedidos del listado sin alterar las facturas ni los registros de caja.'
    );
    if (!confirmar) return;

    this.cargando.set(true);
    this.domiciliosApi.limpiarHistorial().subscribe({
      next: (res) => {
        this.snackBar.open(
          res.mensaje || 'Historial de domicilios limpiado exitosamente.',
          'OK',
          { duration: 4000 }
        );
        this.cargarPedidos();
      },
      error: (err) => {
        this.cargando.set(false);
        const msg = err.error?.message || 'Error al limpiar el historial.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  eliminarDelHistorial(pedido: Domicilio): void {
    const confirmar = confirm(
      `¿Eliminar el pedido #${pedido.numero_pedido} del historial? (La factura en caja permanecerá intacta).`
    );
    if (!confirmar) return;

    this.procesandoId.set(pedido.id_pedido);
    this.domiciliosApi.eliminar(pedido.id_pedido).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.snackBar.open(`Pedido #${pedido.numero_pedido} eliminado del historial.`, 'OK', {
          duration: 3000,
        });
        this.pedidos.update((lista) => lista.filter((p) => p.id_pedido !== pedido.id_pedido));
      },
      error: (err) => {
        this.procesandoId.set(null);
        const msg = err.error?.message || 'Error al eliminar el pedido del historial.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  formatearHora(fecha: string | Date): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
