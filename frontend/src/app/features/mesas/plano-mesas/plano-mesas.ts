import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';
import { NuevaMesaDialogComponent } from '../dialogs/nueva-mesa-dialog';
import { TransferirMesaDialogComponent } from '../dialogs/transferir-mesa-dialog';
import { BorradorPedidoComponent } from '../borrador-pedido/borrador-pedido';
import { DetalleMesaComponent } from '../detalle-mesa/detalle-mesa';

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
    BorradorPedidoComponent,
    DetalleMesaComponent,
  ],
  templateUrl: './plano-mesas.html',
  styleUrl: './plano-mesas.scss',
})
export class PlanoMesasComponent {
  mesasService = inject(MesasService);
  private dialog = inject(MatDialog);

  // Vista activa: 'plano' (tablero general) | 'borrador' (toma de pedido) | 'detalle' (pedidos enviados)
  vistaActiva = signal<'plano' | 'borrador' | 'detalle'>('plano');
  mesaActiva = signal<Mesa | null>(null);

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
    this.mesaActiva.set(mesa);
    if (mesa.estado_visual === 'ocupada') {
      this.vistaActiva.set('detalle');
    } else {
      this.vistaActiva.set('borrador');
    }
  }

  abrirBorradorDirecto(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.mesaActiva.set(mesa);
    this.vistaActiva.set('borrador');
  }

  abrirDetalleDirecto(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.mesaActiva.set(mesa);
    this.vistaActiva.set('detalle');
  }

  abrirNuevoPedido(): void {
    // Desde detalle-mesa, pasa a borrador-pedido para tomar el Pedido N+1
    this.vistaActiva.set('borrador');
  }

  volverAlPlano(): void {
    this.vistaActiva.set('plano');
    this.mesaActiva.set(null);
  }

  onPedidoEnviado(): void {
    // Cuando el pedido se envía con éxito, refresca la mesa activa y vuelve a su detalle
    const id = this.mesaActiva()?.id_mesa;
    if (id) {
      const mesaActual = this.mesasService.mesas().find((m) => m.id_mesa === id);
      if (mesaActual) {
        this.mesaActiva.set(mesaActual);
      }
    }
    this.vistaActiva.set('detalle');
  }

  simularFacturacion(mesa: Mesa, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    if (confirm(`¿Generar Factura para la Mesa #${mesa.numero} por un total de $${mesa.total_acumulado.toLocaleString()} COP?`)) {
      this.mesasService.liberarMesa(mesa.id_mesa);
      if (this.mesaActiva()?.id_mesa === mesa.id_mesa) {
        this.volverAlPlano();
      }
    }
  }
}
