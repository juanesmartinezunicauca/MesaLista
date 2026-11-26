import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';
import { NuevaMesaDialogComponent } from '../dialogs/nueva-mesa-dialog';
import { TransferirMesaDialogComponent } from '../dialogs/transferir-mesa-dialog';
import { FacturaCobroResult, FacturaDialogComponent } from '../dialogs/factura-dialog';
import { BorradorPedidoComponent } from '../borrador-pedido/borrador-pedido';
import { DetalleMesaComponent } from '../detalle-mesa/detalle-mesa';
import { AuthService } from '../../../core/services/auth/auth.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import {
  ImpresionTermicaService,
  ItemTicketTermico,
} from '../../../core/services/print/impresion-termica.service';

@Component({
  selector: 'app-plano-mesas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    BorradorPedidoComponent,
    DetalleMesaComponent,
  ],
  templateUrl: './plano-mesas.html',
  styleUrl: './plano-mesas.scss',
})
export class PlanoMesasComponent implements OnInit {
  mesasService = inject(MesasService);
  authService = inject(AuthService);
  private impresionTermica = inject(ImpresionTermicaService);
  private dialog = inject(MatDialog);
  private facturacionApi = inject(FacturacionApiService);
  private snackBar = inject(MatSnackBar);

  esAdmin = computed<boolean>(() => this.authService.currentUser()?.rol === 'administrador');

  // Vista activa: 'plano' (tablero general) | 'borrador' (toma de pedido) | 'detalle' (pedidos enviados)
  vistaActiva = signal<'plano' | 'borrador' | 'detalle'>('plano');
  mesaActivaId = signal<number | null>(null);

  // Mesa activa computada de forma reactiva desde el servicio global de mesas
  mesaActiva = computed<Mesa | null>(() => {
    const id = this.mesaActivaId();
    if (!id) return null;
    return this.mesasService.mesas().find((m) => m.id_mesa === id) || null;
  });

  ngOnInit(): void {
    // Al acceder al plano de mesas, recarga las mesas y el catálogo fresco desde el backend
    this.mesasService.cargarDatosDesdeBackend();
  }

  abrirNuevaMesaDialog(): void {
    this.dialog.open(NuevaMesaDialogComponent, {
      width: '380px',
    });
  }

  abrirTransferirDialog(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    this.dialog.open(TransferirMesaDialogComponent, {
      data: { mesaOrigen: mesa },
      width: '440px',
    });
  }

  eliminarMesa(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    if (confirm(`¿Estás seguro de retirar la Mesa #${mesa.numero} de la distribución física?`)) {
      const res = this.mesasService.eliminarMesa(mesa.id_mesa);
      if (!res.exito) {
        alert(res.mensaje);
      }
    }
  }

  /**
   * Al hacer clic sobre una tarjeta de mesa:
   * - Si está ocupada: abre el visor de pedidos despachados (detalle)
   * - Si está libre o en pedido: abre la toma del pedido (borrador)
   */
  clickMesa(mesa: Mesa): void {
    this.mesaActivaId.set(mesa.id_mesa);
    if (mesa.estado_visual === 'ocupada') {
      this.vistaActiva.set('detalle');
    } else {
      this.mesasService.cargarCatalogo();
      this.vistaActiva.set('borrador');
    }
  }

  abrirBorradorDirecto(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.mesasService.cargarCatalogo();
    this.mesaActivaId.set(mesa.id_mesa);
    this.vistaActiva.set('borrador');
  }

  abrirDetalleDirecto(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.mesaActivaId.set(mesa.id_mesa);
    this.vistaActiva.set('detalle');
  }

  abrirNuevoPedido(): void {
    // Desde detalle-mesa, pasa a borrador-pedido para tomar el Pedido N+1
    this.mesasService.cargarCatalogo();
    this.vistaActiva.set('borrador');
  }

  volverAlPlano(): void {
    this.vistaActiva.set('plano');
    this.mesaActivaId.set(null);
  }

  onPedidoEnviado(): void {
    // La mesa activa se recalcula automáticamente gracias a mesaActiva = computed(...)
    this.vistaActiva.set('detalle');
  }

  generarFacturaMesa(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    // Capturar instantánea inmutable de la mesa antes de que el cobro/polling limpie los pedidos
    const mesaSnapshot: Mesa = {
      ...mesa,
      pedidos: (mesa.pedidos || []).map((p) => ({
        ...p,
        items: (p.items || []).map((it) => ({ ...it })),
      })),
    };

    const dialogRef = this.dialog.open(FacturaDialogComponent, {
      data: { mesa: mesaSnapshot },
      width: '460px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((resultado: FacturaCobroResult | null) => {
      if (resultado?.cobrado) {
        const pagosPayload = (resultado.pagos || []).map((p) => ({
          medio_pago:
            p.metodo === 'efectivo'
              ? 'Efectivo'
              : p.metodo === 'tarjeta'
              ? 'Tarjeta'
              : 'Transferencia',
          monto: p.monto,
        }));

        this.facturacionApi
          .crearFactura({
            id_mesa: mesaSnapshot.id_mesa,
            propina: resultado.propina,
            pagos: pagosPayload,
          })
          .subscribe({
            next: (factura) => {
              this.imprimirTicketsMesa(mesaSnapshot, factura?.id_venta, resultado, pagosPayload);
              this.mesasService.liberarMesa(mesaSnapshot.id_mesa);
              this.snackBar.open(
                `Factura #${factura.id_venta} registrada e ingresada a Caja.`,
                'Entendido',
                { duration: 3500 }
              );
              if (this.mesaActivaId() === mesaSnapshot.id_mesa) {
                this.volverAlPlano();
              }
            },
            error: (err) => {
              console.warn('Error al facturar en backend:', err);
              const msg = err.error?.message || 'Error al registrar la factura en el servidor.';
              this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
              if (!err.error?.message?.toLowerCase().includes('caja')) {
                this.mesasService.liberarMesa(mesaSnapshot.id_mesa);
                if (this.mesaActivaId() === mesaSnapshot.id_mesa) {
                  this.volverAlPlano();
                }
              }
            },
          });
      }
    });
  }

  private imprimirTicketsMesa(
    mesa: Mesa,
    numeroFactura: number | undefined,
    resultado: FacturaCobroResult,
    pagosPayload: Array<{ medio_pago: string; monto: number }>,
  ): void {
    if (!resultado.imprimirCliente && !resultado.imprimirCocina) return;

    const itemsTicket: ItemTicketTermico[] = [];
    const notasGenerales: string[] = [];

    for (const pedido of mesa.pedidos || []) {
      if (pedido.observacion) notasGenerales.push(pedido.observacion);
      for (const item of pedido.items || []) {
        itemsTicket.push({
          nombre: item.nombre || `Producto #${item.id_producto}`,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          ingredientes_removidos: item.ingredientes_removidos,
          observacion: item.observacion,
        });
      }
    }

    this.impresionTermica.imprimirLote({
      cliente: resultado.imprimirCliente
        ? {
            tipo: 'salon',
            numeroFactura: numeroFactura ?? null,
            numeroMesa: mesa.numero,
            mesero: mesa.mesero_actual || null,
            fecha: new Date(),
            items: itemsTicket,
            subtotal: resultado.subtotal,
            propina: resultado.propina,
            total: resultado.total,
            formaPago: pagosPayload.map((p) => p.medio_pago).join(' + '),
            pagosDetalle: pagosPayload.map((p) => ({ metodo: p.medio_pago, monto: p.monto })),
            efectivoRecibido: resultado.efectivoRecibido,
            cambio: resultado.cambio,
          }
        : null,
      cocina: resultado.imprimirCocina
        ? {
            tipo: 'salon',
            numeroPedido: mesa.pedidos?.[0]?.numero_pedido ?? null,
            numeroMesa: mesa.numero,
            mesero: mesa.mesero_actual || null,
            fecha: new Date(),
            items: itemsTicket,
            observacionGeneral: notasGenerales.join(' | ') || null,
          }
        : null,
    });
  }
}
