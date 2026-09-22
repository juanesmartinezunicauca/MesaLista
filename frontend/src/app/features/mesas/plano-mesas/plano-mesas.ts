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

import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';
import { NuevaMesaDialogComponent } from '../dialogs/nueva-mesa-dialog';
import { TransferirMesaDialogComponent } from '../dialogs/transferir-mesa-dialog';
import { FacturaCobroResult, FacturaDialogComponent } from '../dialogs/factura-dialog';
import { BorradorPedidoComponent } from '../borrador-pedido/borrador-pedido';
import { DetalleMesaComponent } from '../detalle-mesa/detalle-mesa';
import { AuthService } from '../../../core/services/auth/auth.service';

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
export class PlanoMesasComponent implements OnInit {
  mesasService = inject(MesasService);
  authService = inject(AuthService);
  private dialog = inject(MatDialog);

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

    const dialogRef = this.dialog.open(FacturaDialogComponent, {
      data: { mesa },
      width: '460px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((resultado: FacturaCobroResult | null) => {
      if (resultado?.cobrado) {
        this.mesasService.liberarMesa(mesa.id_mesa);
        if (this.mesaActivaId() === mesa.id_mesa) {
          this.volverAlPlano();
        }
      }
    });
  }
}
