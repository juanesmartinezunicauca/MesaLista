import { Component, signal, computed, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  CajaApiService,
  CierreCajaResult,
  ResumenCajaTurno,
} from '../../../core/services/api/caja-api.service';

export interface CierreDeCajaDialogData {
  resumen?: ResumenCajaTurno | null;
  caja?: {
    id_caja: number;
    fecha_apertura: string;
    valor_inicial: number;
    usuario_apertura: string;
  } | null;
}

@Component({
  selector: 'app-cash-closing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './arqueo-caja.html',
  styleUrls: ['./arqueo-caja.scss'],
})
export class CierreDeCaja {
  // Datos base del turno (inicializados dinámicamente según datos del turno activo)
  fondoInicial = signal<number>(0);
  ventasEfectivo = signal<number>(0);
  retirosGastos = signal<number>(0);

  // Valor Esperado = Fondo Inicial + Ventas Efectivo - Retiros/Gastos
  valorEsperado = computed(() => {
    return this.fondoInicial() + this.ventasEfectivo() - this.retirosGastos();
  });

  // Entrada del conteo físico real
  conteoFisico = signal<number | null>(null);
  observaciones = signal<string>('');

  isClosing = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Diferencia = Conteo Físico Real - Valor Esperado
  diferencia = computed(() => {
    const real = this.conteoFisico();
    if (real === null || isNaN(real)) return null;
    return real - this.valorEsperado();
  });

  turnoInfo = computed(() => {
    const c = this.data?.caja;
    if (!c) return 'Actual';
    return `#${c.id_caja} (${c.usuario_apertura || 'Cajero'})`;
  });

  constructor(
    public dialogRef: MatDialogRef<CierreDeCaja>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: CierreDeCajaDialogData | null,
    private cajaApi: CajaApiService,
    private snackBar: MatSnackBar,
  ) {
    if (this.data?.resumen) {
      this.fondoInicial.set(this.data.resumen.valor_base ?? 0);
      this.ventasEfectivo.set(this.data.resumen.ventas_efectivo ?? 0);
      this.retirosGastos.set(this.data.resumen.gastos_efectivo ?? 0);
    } else if (this.data?.caja) {
      this.fondoInicial.set(this.data.caja.valor_inicial ?? 0);
    }
  }

  onCancel(): void {
    if (!this.isClosing()) {
      this.dialogRef.close(false);
    }
  }

  abs(val: number): number {
    return Math.abs(val);
  }

  onConfirm(): void {
    const real = this.conteoFisico();
    if (real === null || isNaN(real) || real < 0) {
      this.errorMessage.set('Por favor, ingresa un valor de conteo físico válido (0 o superior).');
      return;
    }

    this.isClosing.set(true);
    this.errorMessage.set(null);

    this.cajaApi
      .cerrarCaja({
        valor_final_fisico: Number(real),
        observacion: this.observaciones()?.trim() || undefined,
      })
      .subscribe({
        next: (resultado: CierreCajaResult) => {
          this.isClosing.set(false);
          this.snackBar.open('¡Turno de caja cerrado exitosamente!', 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
          this.dialogRef.close(resultado);
        },
        error: (err) => {
          this.isClosing.set(false);
          console.error('Error al cerrar caja:', err);
          this.errorMessage.set(
            err.error?.message || 'Error al procesar el cierre de caja en el servidor.'
          );
        },
      });
  }
}