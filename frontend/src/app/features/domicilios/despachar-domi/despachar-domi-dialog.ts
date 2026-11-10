import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Domicilio, Domiciliario } from '../../../core/models/domicilio.model';
import { GestionarDomisDialogComponent } from '../gestionar-domis/gestionar-domis-dialog';

export interface DespachoResult {
  nombre: string;
  telefono: string;
}

@Component({
  selector: 'app-despachar-domi-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './despachar-domi-dialog.html',
  styleUrl: './despachar-domi-dialog.scss',
})
export class DespacharDomiDialogComponent implements OnInit {
  data = inject<{ pedido: Domicilio }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DespacharDomiDialogComponent, DespachoResult | null>);
  private domiciliosApi = inject(DomiciliosApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  pedido = this.data.pedido;

  repartidores = signal<Domiciliario[]>([]);
  cargando = signal<boolean>(false);

  // 'rep-id' | 'manual'
  modoSeleccion = signal<string>('manual');

  // Repartidor seleccionado
  repartidorSeleccionadoId = signal<string>('');

  // Datos manuales u opcionales
  nombreManual = signal<string>(this.pedido.repartidor?.nombre || '');
  telefonoManual = signal<string>(this.pedido.repartidor?.telefono || '');

  ngOnInit(): void {
    this.cargarRepartidores();
  }

  cargarRepartidores(): void {
    this.cargando.set(true);
    this.domiciliosApi.obtenerRepartidores().subscribe({
      next: (lista) => {
        const activos = (lista || []).filter((r) => r.activo !== false);
        this.repartidores.set(activos);
        this.cargando.set(false);

        // Si hay domiciliarios guardados, preseleccionar el primero o el que coincida
        if (activos.length > 0) {
          const matching = activos.find((r) => r.nombre === this.pedido.repartidor?.nombre);
          if (matching) {
            this.seleccionarRepartidor(matching.id);
          } else {
            this.seleccionarRepartidor(activos[0].id);
          }
        } else {
          this.modoSeleccion.set('manual');
        }
      },
      error: () => {
        const fallback: Domiciliario[] = [
          { id: 'rep-1', nombre: 'Carlos Rodríguez', telefono: '3145678901', vehiculo: 'Moto Suzuki AX100 - Negra', activo: true },
          { id: 'rep-2', nombre: 'Andrés Mina', telefono: '3119876543', vehiculo: 'Moto Yamaha YBR - Azul', activo: true },
          { id: 'rep-3', nombre: 'Mauricio Muñoz', telefono: '3204561234', vehiculo: 'Bicicleta Eléctrica', activo: true },
        ];
        this.repartidores.set(fallback);
        this.seleccionarRepartidor('rep-1');
        this.cargando.set(false);
      },
    });
  }

  seleccionarRepartidor(id: string): void {
    this.modoSeleccion.set('lista');
    this.repartidorSeleccionadoId.set(id);
    const rep = this.repartidores().find((r) => r.id === id);
    if (rep) {
      this.nombreManual.set(rep.nombre);
      this.telefonoManual.set(rep.telefono);
    }
  }

  activarManual(): void {
    this.modoSeleccion.set('manual');
    this.repartidorSeleccionadoId.set('');
  }

  abrirGestionRepartidores(): void {
    const ref = this.dialog.open(GestionarDomisDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
    });

    ref.afterClosed().subscribe(() => {
      this.cargarRepartidores();
    });
  }

  confirmarDespacho(): void {
    let nom = '';
    let tel = '';

    if (this.modoSeleccion() === 'lista') {
      const rep = this.repartidores().find((r) => r.id === this.repartidorSeleccionadoId());
      if (rep) {
        nom = rep.nombre.trim();
        tel = rep.telefono.trim();
      }
    } else {
      nom = this.nombreManual().trim();
      tel = this.telefonoManual().trim();
    }

    if (!nom) {
      this.snackBar.open('Selecciona o ingresa el nombre del domiciliario.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.dialogRef.close({
      nombre: nom,
      telefono: tel || 'N/A',
    });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}

