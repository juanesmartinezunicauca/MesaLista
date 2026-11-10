import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { Domiciliario } from '../../../core/models/domicilio.model';

@Component({
  selector: 'app-gestionar-domis-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './gestionar-domis-dialog.html',
  styleUrl: './gestionar-domis-dialog.scss',
})
export class GestionarDomisDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<GestionarDomisDialogComponent>);
  private domiciliosApi = inject(DomiciliosApiService);
  private snackBar = inject(MatSnackBar);

  repartidores = signal<Domiciliario[]>([]);
  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);

  // Formulario de nuevo domiciliario
  nombre = signal<string>('');
  telefono = signal<string>('');
  vehiculo = signal<string>('');

  ngOnInit(): void {
    this.cargarRepartidores();
  }

  cargarRepartidores(): void {
    this.cargando.set(true);
    this.domiciliosApi.obtenerRepartidores().subscribe({
      next: (lista) => {
        this.repartidores.set(lista || []);
        this.cargando.set(false);
      },
      error: () => {
        // En caso de contingencia o modo offline, cargar lista de respaldo
        const fallback: Domiciliario[] = [
          { id: 'rep-1', nombre: 'Carlos Rodríguez', telefono: '3145678901', vehiculo: 'Moto Suzuki AX100 - Negra', activo: true },
          { id: 'rep-2', nombre: 'Andrés Mina', telefono: '3119876543', vehiculo: 'Moto Yamaha YBR - Azul', activo: true },
          { id: 'rep-3', nombre: 'Mauricio Muñoz', telefono: '3204561234', vehiculo: 'Bicicleta Eléctrica', activo: true },
        ];
        this.repartidores.set(fallback);
        this.cargando.set(false);
      },
    });
  }

  guardar(): void {
    const nom = this.nombre().trim();
    const tel = this.telefono().trim();
    const veh = this.vehiculo().trim() || 'Moto / Vehículo propio';

    if (!nom) {
      this.snackBar.open('Ingresa el nombre del domiciliario.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (!tel || tel.length < 7) {
      this.snackBar.open('Ingresa un teléfono o celular válido.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando.set(true);
    this.domiciliosApi
      .guardarRepartidor({
        nombre: nom,
        telefono: tel,
        vehiculo: veh,
        activo: true,
      })
      .subscribe({
        next: (listaActualizada) => {
          this.guardando.set(false);
          this.repartidores.set(listaActualizada);
          this.nombre.set('');
          this.telefono.set('');
          this.vehiculo.set('');
          this.snackBar.open(`¡Domiciliario "${nom}" guardado exitosamente!`, 'OK', {
            duration: 3500,
          });
        },
        error: (err) => {
          this.guardando.set(false);
          const msg = err.error?.message || 'Error al guardar el domiciliario.';
          this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        },
      });
  }

  eliminar(rep: Domiciliario): void {
    if (!confirm(`¿Eliminar a "${rep.nombre}" de la lista de domiciliarios?`)) {
      return;
    }

    this.domiciliosApi.eliminarRepartidor(rep.id).subscribe({
      next: (listaActualizada) => {
        this.repartidores.set(listaActualizada);
        this.snackBar.open(`Domiciliario "${rep.nombre}" eliminado.`, 'OK', { duration: 3000 });
      },
      error: () => {
        // Fallback local
        this.repartidores.update((list) => list.filter((r) => r.id !== rep.id));
        this.snackBar.open(`Domiciliario removido localmente.`, 'OK', { duration: 3000 });
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close(this.repartidores());
  }
}

