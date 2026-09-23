import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Angular Material
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CajaApiService } from '../../../core/services/api/caja-api.service';

@Component({
  selector: 'app-apertura-caja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatCard,
    MatCardContent,
  ],
  templateUrl: './apertura-caja.html',
  styleUrl: './apertura-caja.scss',
})
export class AperturaCajaComponent implements OnInit {
  private cajaApi = inject(CajaApiService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  valorBase = signal<number | null>(null);
  isLoading = signal<boolean>(true);
  isOpening = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.verificarEstadoCaja();
  }

  verificarEstadoCaja(): void {
    this.isLoading.set(true);
    this.cajaApi.obtenerEstado().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        // Si ya hay una caja abierta, redirigir automáticamente al dashboard
        if (res.abierta) {
          this.router.navigate(['/caja', 'dashboard']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al verificar estado de caja:', err);
      },
    });
  }

  abrirCaja(): void {
    const base = this.valorBase();
    if (base === null || base < 0) {
      this.errorMessage.set('Por favor ingresa un valor base inicial válido (puede ser 0).');
      return;
    }

    this.isOpening.set(true);
    this.errorMessage.set(null);

    this.cajaApi.abrirCaja(base).subscribe({
      next: (res) => {
        this.isOpening.set(false);
        this.snackBar.open(`¡Caja abierta con éxito! Base: $${base.toLocaleString()}`, 'Entendido', {
          duration: 3500,
        });
        this.router.navigate(['/caja', 'dashboard']);
      },
      error: (err) => {
        this.isOpening.set(false);
        console.error('Error al abrir caja:', err);
        this.errorMessage.set(
          err.error?.message || 'No se pudo abrir la caja. Verifica la conexión con el servidor.'
        );
      },
    });
  }

  soloNumeros(event: KeyboardEvent): boolean {
    const charCode = event.key;
    if (/[0-9]/.test(charCode)) {
      return true;
    }
    event.preventDefault();
    return false;
  }
}
