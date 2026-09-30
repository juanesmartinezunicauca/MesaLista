import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import {
  FiltroReporte,
  PeriodoReporteTipo,
  ResumenReporte,
  TurnoCajaReporte,
} from '../../../core/models';
import { ReportesApiService } from '../../../core/services/api/reportes-api.service';

@Component({
  selector: 'app-dashboard-reportes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatTabsModule,
  ],
  templateUrl: './dashboard-reportes.html',
  styleUrls: ['./dashboard-reportes.scss'],
})
export class DashboardReportesComponent implements OnInit {
  private reportesApi = inject(ReportesApiService);
  private snackBar = inject(MatSnackBar);

  // Estados reactivos
  cargando = signal<boolean>(false);
  exportando = signal<boolean>(false);
  periodoSeleccionado = signal<PeriodoReporteTipo>('hoy');
  fechaInicio = signal<string>('');
  fechaFin = signal<string>('');
  busquedaProducto = signal<string>('');

  // Datos del reporte
  resumen = signal<ResumenReporte | null>(null);
  turnosCaja = signal<TurnoCajaReporte[]>([]);

  // KPIs calculados
  kpis = computed(() => {
    const data = this.resumen();
    if (!data) {
      return {
        ingresos_totales: 0,
        subtotal_ventas: 0,
        total_propinas: 0,
        total_gastos: 0,
        utilidad_neta: 0,
        costo_mercancia_vendida: 0,
        margen_bruto: 0,
        porcentaje_margen: 0,
        total_facturas: 0,
        total_pedidos: 0,
        ticket_promedio: 0,
      };
    }
    return data.kpis;
  });

  // Top productos filtrados por buscador local
  topProductosFiltrados = computed(() => {
    const lista = this.resumen()?.top_productos || [];
    const query = this.busquedaProducto().toLowerCase().trim();
    if (!query) return lista;
    return lista.filter(
      (p) =>
        p.nombre.toLowerCase().includes(query) ||
        p.categoria.toLowerCase().includes(query),
    );
  });

  // Máximo valor de serie temporal para escalar las barras visuales
  maxValorSerie = computed(() => {
    const serie = this.resumen()?.serie_temporal || [];
    if (serie.length === 0) return 1;
    let max = 0;
    for (const p of serie) {
      if (p.ingresos > max) max = p.ingresos;
      if (p.gastos > max) max = p.gastos;
    }
    return max > 0 ? max : 1;
  });

  ngOnInit(): void {
    // Inicializar fechas por defecto (hoy)
    const hoyStr = new Date().toISOString().split('T')[0];
    this.fechaInicio.set(hoyStr);
    this.fechaFin.set(hoyStr);

    this.cargarDatos();
    this.cargarTurnosCaja();
  }

  cambiarPeriodo(periodo: PeriodoReporteTipo): void {
    this.periodoSeleccionado.set(periodo);
    if (periodo !== 'personalizado') {
      this.cargarDatos();
    }
  }

  aplicarRangoPersonalizado(): void {
    if (!this.fechaInicio() || !this.fechaFin()) {
      this.snackBar.open('Debes seleccionar fecha inicial y final', 'Cerrar', {
        duration: 3000,
      });
      return;
    }
    if (this.fechaInicio() > this.fechaFin()) {
      this.snackBar.open('La fecha inicial no puede ser mayor a la final', 'Cerrar', {
        duration: 3000,
      });
      return;
    }
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    const filtro: FiltroReporte = {
      periodo: this.periodoSeleccionado(),
      fecha_inicio: this.fechaInicio(),
      fecha_fin: this.fechaFin(),
    };

    this.reportesApi.obtenerResumen(filtro).subscribe({
      next: (data) => {
        this.resumen.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar reporte analítico:', err);
        this.snackBar.open('Error al consultar métricas del reporte', 'Cerrar', {
          duration: 3500,
        });
        this.cargando.set(false);
      },
    });
  }

  cargarTurnosCaja(): void {
    this.reportesApi.obtenerTurnosCaja(15).subscribe({
      next: (turnos) => {
        this.turnosCaja.set(turnos);
      },
      error: (err) => {
        console.error('Error al cargar histórico de turnos:', err);
      },
    });
  }

  descargarCsv(): void {
    this.exportando.set(true);
    const filtro: FiltroReporte = {
      periodo: this.periodoSeleccionado(),
      fecha_inicio: this.fechaInicio(),
      fecha_fin: this.fechaFin(),
    };

    this.reportesApi.descargarCsv(filtro).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fecha = new Date().toISOString().split('T')[0];
        a.download = `reporte_mesalista_${filtro.periodo}_${fecha}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.exportando.set(false);
        this.snackBar.open('Reporte CSV descargado con éxito', 'Cerrar', {
          duration: 3000,
        });
      },
      error: (err) => {
        console.error('Error al exportar CSV:', err);
        this.snackBar.open('No se pudo exportar el archivo CSV', 'Cerrar', {
          duration: 3500,
        });
        this.exportando.set(false);
      },
    });
  }

  imprimir(): void {
    window.print();
  }

  calcularPorcentajeAltura(valor: number): number {
    const max = this.maxValorSerie();
    if (max <= 0) return 0;
    const pct = Math.round((valor / max) * 100);
    return Math.max(pct, 4); // Mínimo 4% para visibilidad
  }
}
