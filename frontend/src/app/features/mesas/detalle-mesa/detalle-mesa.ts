import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';
import { TransferirMesaDialogComponent } from '../dialogs/transferir-mesa-dialog';
import { FacturaCobroResult, FacturaDialogComponent } from '../dialogs/factura-dialog';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import {
  ImpresionTermicaService,
  ItemTicketTermico,
} from '../../../core/services/print/impresion-termica.service';

@Component({
  selector: 'app-detalle-mesa',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './detalle-mesa.html',
  styleUrl: './detalle-mesa.scss',
})
export class DetalleMesaComponent {
  @Input({ required: true }) mesa!: Mesa;
  @Output() cerrar = new EventEmitter<void>();
  @Output() iniciarNuevoPedido = new EventEmitter<void>();

  private dialog = inject(MatDialog);
  private mesasService = inject(MesasService);
  private facturacionApi = inject(FacturacionApiService);
  private impresionTermica = inject(ImpresionTermicaService);
  private snackBar = inject(MatSnackBar);

  abrirDialogoTransferir(): void {
    const dialogRef = this.dialog.open(TransferirMesaDialogComponent, {
      data: { mesaOrigen: this.mesa },
      width: '440px',
    });

    dialogRef.afterClosed().subscribe((transferido) => {
      if (transferido) {
        this.cerrar.emit();
      }
    });
  }

  generarFactura(): void {
    const dialogRef = this.dialog.open(FacturaDialogComponent, {
      data: { mesa: this.mesa },
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
            id_mesa: this.mesa.id_mesa,
            propina: resultado.propina,
            pagos: pagosPayload,
          })
          .subscribe({
            next: (factura) => {
              this.imprimirTicketsMesa(factura?.id_venta, resultado, pagosPayload);
              this.mesasService.liberarMesa(this.mesa.id_mesa);
              this.snackBar.open(
                `Factura #${factura.id_venta} registrada e ingresada a Caja.`,
                'Entendido',
                { duration: 3500 }
              );
              this.cerrar.emit();
            },
            error: (err) => {
              console.warn('Error al facturar en backend:', err);
              const msg = err.error?.message || 'Error al registrar la factura en el servidor.';
              this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
              // Si la falla no es por caja cerrada, permitir liberar en memoria
              if (!err.error?.message?.toLowerCase().includes('caja')) {
                this.mesasService.liberarMesa(this.mesa.id_mesa);
                this.cerrar.emit();
              }
            },
          });
      }
    });
  }

  private imprimirTicketsMesa(
    numeroFactura: number | undefined,
    resultado: FacturaCobroResult,
    pagosPayload: Array<{ medio_pago: string; monto: number }>,
  ): void {
    if (!resultado.imprimirCliente && !resultado.imprimirCocina) return;

    const itemsTicket: ItemTicketTermico[] = [];
    const notasGenerales: string[] = [];

    for (const pedido of this.mesa.pedidos || []) {
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

    const imprimirCliente = () => {
      this.impresionTermica.imprimirFacturaCliente({
        tipo: 'salon',
        numeroFactura: numeroFactura ?? null,
        numeroMesa: this.mesa.numero,
        mesero: this.mesa.mesero_actual || null,
        fecha: new Date(),
        items: itemsTicket,
        subtotal: resultado.subtotal,
        propina: resultado.propina,
        total: resultado.total,
        formaPago: pagosPayload.map((p) => p.medio_pago).join(' + '),
        pagosDetalle: pagosPayload.map((p) => ({ metodo: p.medio_pago, monto: p.monto })),
        efectivoRecibido: resultado.efectivoRecibido,
        cambio: resultado.cambio,
      });
    };

    const imprimirCocina = () => {
      this.impresionTermica.imprimirComandaCocina({
        tipo: 'salon',
        numeroPedido: this.mesa.pedidos?.[0]?.numero_pedido ?? null,
        numeroMesa: this.mesa.numero,
        mesero: this.mesa.mesero_actual || null,
        fecha: new Date(),
        items: itemsTicket,
        observacionGeneral: notasGenerales.join(' | ') || null,
      });
    };

    if (resultado.imprimirCliente) {
      imprimirCliente();
    }
    if (resultado.imprimirCocina) {
      if (resultado.imprimirCliente) {
        setTimeout(imprimirCocina, 650);
      } else {
        imprimirCocina();
      }
    }
  }

  liberarMesaManual(): void {
    if (confirm(`¿Estás seguro de liberar la Mesa #${this.mesa.numero} sin registrar cobro?`)) {
      this.mesasService.liberarMesa(this.mesa.id_mesa);
      this.cerrar.emit();
    }
  }
}
