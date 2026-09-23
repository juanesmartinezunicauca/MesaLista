import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CajaApiService, CierreCajaResult, ResumenCajaTurno } from '../../../core/services/api/caja-api.service';

@Component({
  selector: 'app-arqueo-cierre-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './arqueo-cierre-dialog.html',
  styleUrl: './arqueo-cierre-dialog.scss',
})
export class ArqueoCierreDialogComponent {
  data = inject<{ resumen: ResumenCajaTurno; caja: any }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ArqueoCierreDialogComponent>);
  private cajaApi = inject(CajaApiService);
  private snackBar = inject(MatSnackBar);

  valorFisicoInput = signal<number | null>(null);
  observacion = signal<string>('');
  isClosing = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  resultadoCierre = signal<CierreCajaResult | null>(null);

  efectivoTeorico = computed<number>(() => {
    return this.data.resumen?.efectivo_esperado || 0;
  });

  diferencia = computed<number>(() => {
    const fisico = this.valorFisicoInput();
    if (fisico === null) return 0;
    return fisico - this.efectivoTeorico();
  });

  tipoCuadre = computed<'pendiente' | 'exacto' | 'sobrante' | 'faltante'>(() => {
    if (this.valorFisicoInput() === null) return 'pendiente';
    const diff = this.diferencia();
    if (diff === 0) return 'exacto';
    return diff > 0 ? 'sobrante' : 'faltante';
  });

  confirmarCierre(): void {
    const fisico = this.valorFisicoInput();
    if (fisico === null || fisico < 0) {
      this.errorMessage.set('Debe ingresar un valor físico válido (conteo de billetes y monedas).');
      return;
    }

    this.isClosing.set(true);
    this.errorMessage.set(null);

    this.cajaApi
      .cerrarCaja({
        valor_final_fisico: Number(fisico),
        observacion: this.observacion().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isClosing.set(false);
          this.resultadoCierre.set(res);
          this.snackBar.open('¡Caja cerrada exitosamente!', 'Cerrar', { duration: 4000 });
        },
        error: (err) => {
          this.isClosing.set(false);
          console.error('Error cerrando caja:', err);
          this.errorMessage.set(err.error?.message || 'Error al procesar el cierre de caja.');
        },
      });
  }

  imprimirComprobante(): void {
    window.print();
  }

  cerrarModal(): void {
    const fueCerrada = Boolean(this.resultadoCierre());
    this.dialogRef.close(fueCerrada);
  }
}
