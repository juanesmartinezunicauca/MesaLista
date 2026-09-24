import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { NewDeliveryDialogComponent } from '../nuevo-domicilio/nuevo-domi-modal';

export interface PedidoDomicilio {
  id: string;
  hora: string; // Formato HH:mm para ordenamiento
  cliente: string;
  direccion: string;
  total: number;
  estado: 'En Preparación' | 'En Reparto' | 'Entregado';
}

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatButtonToggleModule,
  ],
  templateUrl: './dashboard-domis.html',
  styleUrls: ['./dashboard-domis.scss'],
})
export class DashboardDomisComponent {
  // Filtro activo actual
  filtroEstado = signal<string>('Todos');
  constructor(private dialog: MatDialog) {}

  // Mock data inicial (ordenada dinámicamente de más reciente a más antiguo)
  pedidos = signal<PedidoDomicilio[]>([
    {
      id: '#1045',
      hora: '14:25',
      cliente: 'María Rodríguez',
      direccion: 'Calle 5N # 12-45',
      total: 45000,
      estado: 'En Preparación',
    },
    {
      id: '#1044',
      hora: '14:10',
      cliente: 'Carlos Gómez',
      direccion: 'Carrera 9 # 3-21',
      total: 78500,
      estado: 'En Reparto',
    },
    {
      id: '#1043',
      hora: '13:50',
      cliente: 'Ana María Paz',
      direccion: 'Avenida Panamericana # 4-10',
      total: 32000,
      estado: 'En Reparto',
    },
    {
      id: '#1042',
      hora: '13:15',
      cliente: 'Esteban Quintero',
      direccion: 'Calle 2 # 8-33',
      total: 95000,
      estado: 'En Preparación',
    },
  ]);

  // Lista filtrada y ordenada de más reciente a más antiguo por hora
  pedidosFiltrados = computed(() => {
    const filtro = this.filtroEstado();
    const lista = [...this.pedidos()].sort((a, b) => b.hora.localeCompare(a.hora));

    if (filtro === 'Todos') {
      return lista;
    }
    return lista.filter((p) => p.estado === filtro);
  });

  cambiarFiltro(event: any) {
    this.filtroEstado.set(event.value);
  }

  crearNuevoPedido() {
    // Lógica para abrir modal o navegar a creación de pedido
    // 3. Abrir el modal
    const dialogRef = this.dialog.open(NewDeliveryDialogComponent, {
      width: '680px',
      disableClose: true, // Evita que se cierre al hacer clic fuera del modal
    });

    // 4. Capturar el resultado cuando el usuario guarde o cancele
    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado) {
        console.log('Nuevo pedido registrado:', resultado);

        // Aquí puedes actualizar tu lista de pedidos usando tu signal:
        // this.pedidos.update(listaActual => [resultado, ...listaActual]);
      }
    });
  }
}
