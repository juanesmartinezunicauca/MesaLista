import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  CajaApiService,
  EstadoCajaResponse,
  MovimientoCaja,
  ResumenCajaTurno,
} from '../../../core/services/api/caja-api.service';
import { ModalGastoDialogComponent } from '../modal-gasto/modal-gasto-dialog';
import { CierreDeCaja } from '../arqueo-cierre/arqueo-caja';

@Component({
  selector: 'app-dashboard-caja',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './dashboard-caja.html',
  styleUrls: ['./dashboard-caja.scss'],
})
export class DashboardCajaComponent implements OnInit {
  private cajaApi = inject(CajaApiService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  isLoading = signal<boolean>(true);
  errorMensaje = signal<string | null>(null);
  estadoCaja = signal<EstadoCajaResponse | null>(null);

  displayedColumns: string[] = ['hora', 'descripcion', 'tipo', 'medio_pago', 'monto'];

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(mostrarSpinner = true): void {
    if (mostrarSpinner) this.isLoading.set(true);
    this.errorMensaje.set(null);

    this.cajaApi.obtenerEstado().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.abierta) {
          // Si no hay caja abierta, redirigir a la vista de apertura
          this.router.navigate(['/caja']);
          return;
        }
        this.estadoCaja.set(res);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al cargar estado de caja:', err);
        this.errorMensaje.set('No se pudo conectar con el servidor para obtener los datos de la caja.');
      },
    });
  }

  // Getters computados para el resumen
  caja = computed(() => this.estadoCaja()?.caja);
  resumen = computed<ResumenCajaTurno | null>(() => this.estadoCaja()?.resumen || null);
  movimientos = computed<MovimientoCaja[]>(() => this.estadoCaja()?.movimientos || []);

  get fechaApertura(): string {
    const f = this.caja()?.fecha_apertura;
    if (!f) return 'Hoy';
    const d = new Date(f);
    return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  get usuarioApertura(): string {
    return this.caja()?.usuario_apertura || 'Cajero';
  }

  get valorBase(): number {
    return this.resumen()?.valor_base || 0;
  }

  get ventasDia(): number {
    return this.resumen()?.total_ventas || 0;
  }

  get totalTransacciones(): number {
    return this.resumen()?.total_transacciones || 0;
  }

  get efectivoVentas(): number {
    return this.resumen()?.ventas_efectivo || 0;
  }

  get tarjetaVentas(): number {
    return this.resumen()?.ventas_tarjeta || 0;
  }

  get transferenciaVentas(): number {
    return this.resumen()?.ventas_transferencia || 0;
  }

  get gastosRetiros(): number {
    return this.resumen()?.total_gastos || 0;
  }

  get movimientosGastos(): number {
    return this.resumen()?.total_movimientos_gasto || 0;
  }

  get efectivoEsperado(): number {
    return this.resumen()?.efectivo_esperado || 0;
  }

  get desgloseGastosArray(): Array<{ tipo: string; monto: number }> {
    const desglose = this.resumen()?.desglose_gastos || {};
    return Object.entries(desglose).map(([tipo, monto]) => ({ tipo, monto }));
  }

  registrarGasto(): void {
    const dialogRef = this.dialog.open(ModalGastoDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((guardado) => {
      if (guardado) {
        this.cargarDatos(false);
      }
    });
  }

  cerrarCaja(): void {
    const res = this.resumen();
    const caj = this.caja();
    if (!res || !caj) return;

    const dialogRef = this.dialog.open(CierreDeCaja, {
      disableClose: true,
      data: { resumen: res, caja: caj },
      width: '600px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((cerrada) => {
      if (cerrada) {
        this.router.navigate(['/caja']);
      }
    });
  }

  abrirEditarBase(): void {
    const baseActual = this.valorBase;
    const inputStr = prompt('Ingresa el nuevo valor base inicial en efectivo para la caja:', String(baseActual));
    if (inputStr === null) return;

    const nuevoValor = Number(inputStr.trim());
    if (isNaN(nuevoValor) || nuevoValor < 0) {
      this.snackBar.open('Por favor ingresa un monto válido (0 o superior).', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cajaApi.actualizarBase(nuevoValor).subscribe({
      next: () => {
        this.snackBar.open(`¡Base inicial de caja actualizada a $${nuevoValor.toLocaleString()}!`, 'Cerrar', {
          duration: 3500,
        });
        this.cargarDatos(false);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error al actualizar el valor base de la caja.', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  formatearHora(fechaIso: string): string {
    const d = new Date(fechaIso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}