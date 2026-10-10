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
  ventasTransferencia = signal<number>(0);
  ventasTarjeta = signal<number>(0);
  totalVentas = signal<number>(0);

  // Valor Esperado en Efectivo = Fondo Inicial + Ventas Efectivo - Retiros/Gastos
  valorEsperado = computed(() => {
    return this.fondoInicial() + this.ventasEfectivo() - this.retirosGastos();
  });

  // Entrada de conteo físico real de efectivo
  conteoFisico = signal<number | null>(null);

  // Entrada manual de transferencias bancarias verificadas en app (Nequi/Daviplata/Bancos)
  conteoTransferencias = signal<number | null>(null);
  transferenciasVerificadas = signal<boolean>(false);

  observaciones = signal<string>('');
  isClosing = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Diferencia Efectivo = Conteo Físico Real - Valor Esperado
  diferencia = computed(() => {
    const real = this.conteoFisico();
    if (
      real === null ||
      real === undefined ||
      (typeof real === 'string' && (real as string).trim() === '') ||
      isNaN(Number(real))
    ) {
      return null;
    }
    return Number(real) - this.valorEsperado();
  });

  // Diferencia en Transferencias = Conteo Manual App - Ventas Transferencia Sistema
  diferenciaTransferencias = computed(() => {
    if (this.ventasTransferencia() === 0) return 0;
    const realTransf = this.conteoTransferencias();
    if (
      realTransf === null ||
      realTransf === undefined ||
      (typeof realTransf === 'string' && (realTransf as string).trim() === '') ||
      isNaN(Number(realTransf))
    ) {
      return null;
    }
    return Number(realTransf) - this.ventasTransferencia();
  });

  hayDescuadreEfectivo = computed(() => {
    const diff = this.diferencia();
    return diff !== null && Math.abs(diff) >= 0.01;
  });

  hayDescuadreTransferencias = computed(() => {
    const diffT = this.diferenciaTransferencias();
    return diffT !== null && Math.abs(diffT) >= 0.01;
  });

  hayDescuadre = computed(() => {
    return this.hayDescuadreEfectivo() || this.hayDescuadreTransferencias();
  });

  // Bloqueo del botón de cierre según validaciones estrictas
  puedeCerrar = computed(() => {
    if (this.isClosing()) return false;

    // 1. Debe haber conteo físico válido
    const fisico = this.conteoFisico();
    if (fisico === null || isNaN(Number(fisico)) || Number(fisico) < 0) {
      return false;
    }

    // 2. Si hay transferencias registradas en el turno, debe confirmarlas explícitamente y tener monto
    if (this.ventasTransferencia() > 0) {
      if (!this.transferenciasVerificadas()) return false;
      const t = this.conteoTransferencias();
      if (t === null || isNaN(Number(t)) || Number(t) < 0) return false;
    }

    // 3. Si hay descuadre en efectivo o transferencias, es OBLIGATORIO ingresar observaciones
    if (this.hayDescuadre()) {
      if (!this.observaciones()?.trim() || this.observaciones().trim().length < 4) {
        return false;
      }
    }

    return true;
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
      const transf = this.data.resumen.ventas_transferencia ?? 0;
      this.ventasTransferencia.set(transf);
      this.conteoTransferencias.set(transf);
      this.ventasTarjeta.set(this.data.resumen.ventas_tarjeta ?? 0);
      this.totalVentas.set(this.data.resumen.total_ventas ?? 0);
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

  igualarTransferencias(): void {
    this.conteoTransferencias.set(this.ventasTransferencia());
  }

  onConfirm(): void {
    if (!this.puedeCerrar()) {
      if (this.hayDescuadre() && (!this.observaciones()?.trim() || this.observaciones().trim().length < 4)) {
        this.errorMessage.set('Se detectó un descuadre. Por favor escribe una observación explicando el motivo.');
        return;
      }
      this.errorMessage.set('Por favor completa todos los campos requeridos antes de cerrar la caja.');
      return;
    }

    const real = this.conteoFisico();
    this.isClosing.set(true);
    this.errorMessage.set(null);

    const notas: string[] = [];
    if (this.ventasTransferencia() > 0) {
      const realT = Number(this.conteoTransferencias());
      const difT = this.diferenciaTransferencias() ?? 0;
      if (difT !== 0) {
        notas.push(`[Transf. Banco: $${realT.toLocaleString()} vs Sistema: $${this.ventasTransferencia().toLocaleString()} (Dif: ${difT > 0 ? '+' : ''}$${difT.toLocaleString()})]`);
      } else {
        notas.push('[Transferencias conciliadas exactas]');
      }
    }
    if (this.observaciones()?.trim()) {
      notas.push(this.observaciones().trim());
    }
    const obsFinal = notas.length > 0 ? notas.join(' | ').slice(0, 255) : undefined;

    this.cajaApi
      .cerrarCaja({
        valor_final_fisico: Number(real),
        valor_transferencias_reportado:
          this.conteoTransferencias() !== null ? Number(this.conteoTransferencias()) : undefined,
        observacion: obsFinal,
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