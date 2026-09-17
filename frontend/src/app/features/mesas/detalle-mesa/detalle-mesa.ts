import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';
import { TransferirMesaDialogComponent } from '../dialogs/transferir-mesa-dialog';

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

  simularFacturacion(): void {
    if (confirm(`¿Generar Factura para la Mesa #${this.mesa.numero} por un total de $${this.mesa.total_acumulado.toLocaleString()} COP? Los pedidos pasarán a estado cerrado y la mesa quedará libre.`)) {
      this.mesasService.liberarMesa(this.mesa.id_mesa);
      this.cerrar.emit();
    }
  }

  liberarMesaManual(): void {
    if (confirm(`¿Estás seguro de liberar la Mesa #${this.mesa.numero}?`)) {
      this.mesasService.liberarMesa(this.mesa.id_mesa);
      this.cerrar.emit();
    }
  }
}
