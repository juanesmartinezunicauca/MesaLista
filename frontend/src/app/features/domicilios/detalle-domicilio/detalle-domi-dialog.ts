import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Domicilio } from '../../../core/models';

export interface DetalleDomiDialogData {
  pedido: Domicilio;
}

export type DetalleDomiAccion =
  | 'cerrar'
  | 'aceptar'
  | 'rechazar'
  | 'despachar'
  | 'facturar'
  | 'cerrar_pedido'
  | 'reasignar_repartidor';

@Component({
  selector: 'app-detalle-domi-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './detalle-domi-dialog.html',
  styleUrl: './detalle-domi-dialog.scss',
})
export class DetalleDomiDialogComponent {
  data = inject<DetalleDomiDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DetalleDomiDialogComponent>);

  pedido = this.data.pedido;

  totalItems = computed(() => {
    return (this.pedido.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);
  });

  cerrar(): void {
    this.dialogRef.close({ accion: 'cerrar' });
  }

  aceptar(): void {
    this.dialogRef.close({ accion: 'aceptar', pedido: this.pedido });
  }

  rechazar(): void {
    this.dialogRef.close({ accion: 'rechazar', pedido: this.pedido });
  }

  despachar(): void {
    this.dialogRef.close({ accion: 'despachar', pedido: this.pedido });
  }

  facturar(): void {
    this.dialogRef.close({ accion: 'facturar', pedido: this.pedido });
  }

  cerrarPedido(): void {
    this.dialogRef.close({ accion: 'cerrar_pedido', pedido: this.pedido });
  }

  reasignarRepartidor(): void {
    this.dialogRef.close({ accion: 'reasignar_repartidor', pedido: this.pedido });
  }
}
