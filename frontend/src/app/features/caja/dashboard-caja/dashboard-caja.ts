import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CierreDeCaja } from '../arqueo-cierre/arqueo-caja';

interface Movimiento {
  hora: string;
  descripcion: string;
  tipo: 'Ingreso' | 'Gasto' | 'Ingreso (T)';
  monto: number;
}

@Component({
  selector: 'app-dashboard-caja',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './dashboard-caja.html',
  styleUrls: ['./dashboard-caja.scss']
})
export class DashboardCajaComponent {
  constructor(private dialog: MatDialog, readonly router: Router) {}

  // Datos simulados de la caja
  cajaAbierta = signal<boolean>(true);
  fechaApertura = signal<string>('Hoy, 08:30 AM');
  usuario = signal<string>('Carlos D. (Admin)');
  valorBase = signal<number>(150000);
  
  ventasDia = signal<number>(1245500);
  totalTransacciones = signal<number>(24);
  efectivoVentas = signal<number>(800000);
  tarjetaVentas = signal<number>(445000);

  gastosRetiros = signal<number>(85000);
  movimientosGastos = signal<number>(2);
  gastoInsumos = signal<number>(50000);
  gastoAseo = signal<number>(35000);

  // Efectivo esperado = Base + Ventas Efectivo - Gastos
  get efectivoEsperado(): number {
    return this.valorBase() + this.efectivoVentas() - this.gastosRetiros();
  }

  // Columnas de la tabla
  displayedColumns: string[] = ['hora', 'descripcion', 'tipo', 'monto'];

  // Movimientos recientes
  movimientos = signal<Movimiento[]>([
    { hora: '14:30', descripcion: 'Pago Mesa 12 (Efectivo)', tipo: 'Ingreso', monto: 45000 },
    { hora: '13:15', descripcion: 'Compra Insumos (Hielo)', tipo: 'Gasto', monto: -50000 },
    { hora: '12:45', descripcion: 'Pago Mesa 04 (Tarjeta)', tipo: 'Ingreso (T)', monto: 120000 },
    { hora: '11:10', descripcion: 'Pago Mesa 01 (Efectivo)', tipo: 'Ingreso', monto: 32500 }
  ]);

  registrarGasto() {
    // Lógica para abrir modal de gasto
  }

  cerrarCaja() {
    this.dialog.open(CierreDeCaja, {
      width: '600px', // O el tamaño que prefieras para tu diseño
      disableClose: true // Evita que se cierre haciendo clic afuera
    });
  }

  verTodosMovimientos() {
    // Lógica para ver historial completo
  }
}