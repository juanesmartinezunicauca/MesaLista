import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Mesa } from '../models/mesa.model';
import { MesasService } from '../services/mesas.service';

@Component({
  selector: 'app-transferir-mesa-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon class="title-icon">swap_horiz</mat-icon>
        <span>Transferir Comanda - Mesa #{{ data.mesaOrigen.numero }}</span>
      </h2>

      <mat-dialog-content class="dialog-content">
        <p class="dialog-description">
          Selecciona la mesa de destino. Si la mesa destino ya tiene pedidos, se unificarán todos los pedidos bajo una sola cuenta.
        </p>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Mesa de Destino</mat-label>
          <mat-select [(ngModel)]="idMesaDestino">
            @for (mesa of mesasDisponibles(); track mesa.id_mesa) {
              <mat-option [value]="mesa.id_mesa">
                Mesa #{{ mesa.numero }} ({{ mesa.estado_visual === 'libre' ? 'Libre' : 'Ocupada - Unificar cuenta' }})
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (errorMensaje) {
          <div class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMensaje }}</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancelar</button>
        <button
          mat-flat-button
          color="primary"
          class="btn-transfer"
          [disabled]="!idMesaDestino"
          (click)="confirmarTransferencia()"
        >
          <mat-icon>check</mat-icon>
          <span>Confirmar Traslado</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      @use 'tokens' as *;

      .dialog-container {
        padding: 8px;
        min-width: 360px;
      }

      .dialog-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.2rem;
        font-weight: 700;
        color: $text-primary;

        .title-icon {
          color: $brand-blue;
        }
      }

      .dialog-description {
        color: $text-muted;
        font-size: 0.875rem;
        margin-bottom: 16px;
        line-height: 1.4;
      }

      .w-full {
        width: 100%;
      }

      .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: $color-danger-bg;
        color: $color-danger;
        padding: 8px 12px;
        border-radius: $radius-md;
        font-size: 0.85rem;
        margin-top: 8px;
      }

      .btn-transfer {
        background-color: $brand-blue !important;
        color: #ffffff !important;
        border-radius: $radius-md;
      }
    `,
  ],
})
export class TransferirMesaDialogComponent {
  data = inject<{ mesaOrigen: Mesa }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TransferirMesaDialogComponent>);
  private mesasService = inject(MesasService);

  idMesaDestino: number | null = null;
  errorMensaje: string = '';

  mesasDisponibles = () =>
    this.mesasService.mesas().filter((m) => m.id_mesa !== this.data.mesaOrigen.id_mesa);

  confirmarTransferencia(): void {
    if (!this.idMesaDestino) return;

    const resultado = this.mesasService.transferirMesa(
      this.data.mesaOrigen.id_mesa,
      this.idMesaDestino
    );

    if (!resultado.exito) {
      this.errorMensaje = resultado.mensaje;
      return;
    }

    this.dialogRef.close(true);
  }
}
