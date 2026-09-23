import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { PedidosApiService } from '../../../core/services/api/pedidos-api.service';

export interface ItemComanda {
  id_item: number;
  nombre_producto: string;
  cantidad: number;
  ingredientes_removidos?: string | null;
  observacion?: string | null;
}

export interface TarjetaComanda {
  id_pedido: number;
  numero_pedido: number;
  tipo: 'salon' | 'domicilio';
  id_mesa?: number;
  numero_mesa?: number;
  nombre_mesero: string;
  fecha_hora: Date;
  observacion_general?: string | null;
  items: ItemComanda[];
  minutos_transcurridos: number;
}

@Component({
  selector: 'app-vista-cocina',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './vista-cocina.html',
  styleUrl: './vista-cocina.scss',
})
export class VistaCocinaComponent implements OnInit, OnDestroy {
  private pedidosApi = inject(PedidosApiService);

  isLoading = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);
  pedidosRaw = signal<any[]>([]);
  tiempoActual = signal<number>(Date.now());

  private intervaloPolling: any = null;
  private intervaloReloj: any = null;

  ngOnInit(): void {
    this.cargarComandas();

    // Actualiza automáticamente cada 15 segundos para recibir nuevos pedidos
    this.intervaloPolling = setInterval(() => {
      this.cargarComandas(false);
    }, 15000);

    // Actualiza el reloj de tiempo transcurrido cada 30 segundos
    this.intervaloReloj = setInterval(() => {
      this.tiempoActual.set(Date.now());
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.intervaloPolling) clearInterval(this.intervaloPolling);
    if (this.intervaloReloj) clearInterval(this.intervaloReloj);
  }

  cargarComandas(mostrarSpinner = true): void {
    if (mostrarSpinner) this.isLoading.set(true);
    this.errorMensaje.set(null);

    this.pedidosApi.obtenerTodos({ estado: 'enviada' }).subscribe({
      next: (pedidos) => {
        this.pedidosRaw.set(pedidos || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Error al cargar comandas:', err);
        this.errorMensaje.set('No se pudo conectar con el servidor.');
        this.isLoading.set(false);
      },
    });
  }

  comandas = computed<TarjetaComanda[]>(() => {
    const rawList = this.pedidosRaw();
    const ahora = this.tiempoActual();

    return rawList.map((p) => {
      const fecha = new Date(p.fecha_hora);
      const minutos = Math.max(0, Math.floor((ahora - fecha.getTime()) / (1000 * 60)));

      const items: ItemComanda[] = (p.items || []).map((it: any) => ({
        id_item: it.id_item,
        nombre_producto: it.producto?.nombre || 'Producto',
        cantidad: it.cantidad,
        ingredientes_removidos: it.ingredientes_removidos,
        observacion: it.observacion,
      }));

      return {
        id_pedido: p.id_pedido,
        numero_pedido: p.numero_pedido,
        tipo: p.tipo,
        id_mesa: p.id_mesa,
        numero_mesa: p.mesa?.numero,
        nombre_mesero: p.usuario?.nombre || 'Mesero',
        fecha_hora: fecha,
        observacion_general: p.observacion,
        items,
        minutos_transcurridos: minutos,
      };
    });
  });

  formatearHora(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(fecha);
  }
}
