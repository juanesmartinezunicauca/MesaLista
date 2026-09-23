import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  ],
  templateUrl: './arqueo-caja.html',
  styleUrls: ['./arqueo-caja.scss'],
})
export class CierreDeCaja {
  // Datos base del turno (simulados o inyectados)
  fondoInicial = signal<number>(1500.0);
  ventasEfectivo = signal<number>(4250.0);
  retirosGastos = signal<number>(200.0);

  // Valor Esperado = Fondo Inicial + Ventas Efectivo - Retiros/Gastos
  valorEsperado = computed(() => {
    return this.fondoInicial() + this.ventasEfectivo() - this.retirosGastos();
  });

  // Entrada del conteo físico real
  conteoFisico = signal<number | null>(null);
  observaciones = signal<string>('');

  // Diferencia = Conteo Físico Real - Valor Esperado
  diferencia = computed(() => {
    const real = this.conteoFisico();
    if (real === null || isNaN(real)) return null;
    return real - this.valorEsperado();
  });

  constructor(public dialogRef: MatDialogRef<CierreDeCaja>) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }
  abs(val: number): number {
    return Math.abs(val);
  }
  onConfirm(): void {
    const resultado = {
      conteoFisico: this.conteoFisico(),
      valorEsperado: this.valorEsperado(),
      diferencia: this.diferencia(),
      observaciones: this.observaciones(),
    };
    this.dialogRef.close(resultado);
  }
}
