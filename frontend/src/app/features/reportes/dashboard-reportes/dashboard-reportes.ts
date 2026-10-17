import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';

// Servicios y Utilidades
import {
  CajaMediosReporteResponse,
  DashboardReporteResponse,
  GastosReporteResponse,
  InventarioReporteResponse,
  OperacionReporteResponse,
  RentabilidadReporteResponse,
  ReportesApiService,
  VentasReporteResponse,
} from '../../../core/services/api/reportes-api.service';
import { exportarACSV } from '../../../core/utils/export-csv.util';

export type PeriodoPreset = 'hoy' | '7dias' | 'mes' | 'personalizado';

@Component({
  selector: 'app-dashboard-reportes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    PercentPipe,
  ],
  templateUrl: './dashboard-reportes.html',
  styleUrl: './dashboard-reportes.scss',
})
export class DashboardReportesComponent implements OnInit {
  private reportesApi = inject(ReportesApiService);

  // Estados reactivos (Signals)
  cargando = signal<boolean>(true);
  errorMensaje = signal<string | null>(null);
  tabActivaIndex = signal<number>(0);

  // Filtros de fecha
  presetSeleccionado = signal<PeriodoPreset>('mes');
  fechaInicio = signal<string>('');
  fechaFin = signal<string>('');

  // Filtros secundarios
  filtroCategoria = signal<string>('');
  filtroTipoServicio = signal<string>('');
  filtroStock = signal<'todos' | 'bajo' | 'agotado'>('todos');
  filtroBusquedaInv = signal<string>('');

  // Datos cargados desde el backend
  dashboardData = signal<DashboardReporteResponse | null>(null);
  ventasData = signal<VentasReporteResponse | null>(null);
  cajaMediosData = signal<CajaMediosReporteResponse | null>(null);
  inventarioData = signal<InventarioReporteResponse | null>(null);
  gastosData = signal<GastosReporteResponse | null>(null);
  rentabilidadData = signal<RentabilidadReporteResponse | null>(null);
  operacionData = signal<OperacionReporteResponse | null>(null);

  // Tooltip interactivo para gráfica de ventas
  tooltipActivo = signal<{ x: number; y: number; fecha: string; monto: number; cuentas: number } | null>(null);

  // Categorías extraídas dinámicamente
  categoriasDisponibles = computed(() => {
    const v = this.ventasData();
    if (v?.categorias) {
      return v.categorias.map((c) => c.categoria);
    }
    const inv = this.inventarioData();
    if (inv?.productos) {
      return Array.from(new Set(inv.productos.map((p) => p.categoria)));
    }
    return [];
  });

  // Inventario filtrado en vista cliente
  inventarioFiltrado = computed(() => {
    const inv = this.inventarioData();
    if (!inv) return [];

    let prods = [...inv.productos];
    const cat = this.filtroCategoria().toLowerCase();
    if (cat) {
      prods = prods.filter((p) => p.categoria.toLowerCase() === cat);
    }

    const stockMode = this.filtroStock();
    if (stockMode === 'bajo') {
      prods = prods.filter((p) => p.estado_stock === 'bajo');
    } else if (stockMode === 'agotado') {
      prods = prods.filter((p) => p.estado_stock === 'agotado');
    }

    const q = this.filtroBusquedaInv().toLowerCase().trim();
    if (q) {
      prods = prods.filter((p) => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
    }

    return prods;
  });

  ngOnInit(): void {
    this.aplicarPresetFechas('mes');
  }

  aplicarPresetFechas(preset: PeriodoPreset): void {
    this.presetSeleccionado.set(preset);
    const ahora = new Date();
    const formato = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'hoy') {
      const hoyStr = formato(ahora);
      this.fechaInicio.set(hoyStr);
      this.fechaFin.set(hoyStr);
    } else if (preset === '7dias') {
      const hace7Dias = new Date();
      hace7Dias.setDate(ahora.getDate() - 6);
      this.fechaInicio.set(formato(hace7Dias));
      this.fechaFin.set(formato(ahora));
    } else if (preset === 'mes') {
      const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      this.fechaInicio.set(formato(primerDia));
      this.fechaFin.set(formato(ahora));
    }

    this.cargarDatosSegunTab();
  }

  cambiarTab(index: number): void {
    this.tabActivaIndex.set(index);
    this.cargarDatosSegunTab();
  }

  cargarDatosSegunTab(): void {
    this.cargando.set(true);
    this.errorMensaje.set(null);

    const fInicio = this.fechaInicio() || undefined;
    const fFin = this.fechaFin() || undefined;
    const tab = this.tabActivaIndex();

    // Siempre cargamos dashboard si está en tab 0 o es primera vez
    if (tab === 0) {
      this.reportesApi.obtenerDashboard({ fecha_inicio: fInicio, fecha_fin: fFin }).subscribe({
        next: (data) => {
          this.dashboardData.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMensaje.set(err?.error?.message || 'Error al cargar los indicadores del dashboard.');
          this.cargando.set(false);
        },
      });
    } else if (tab === 1) {
      // Ventas
      this.reportesApi
        .obtenerVentas({
          fecha_inicio: fInicio,
          fecha_fin: fFin,
          categoria: this.filtroCategoria() || undefined,
          tipo_servicio: this.filtroTipoServicio() || undefined,
        })
        .subscribe({
          next: (data) => {
            this.ventasData.set(data);
            this.cargando.set(false);
          },
          error: (err) => {
            this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte de ventas.');
            this.cargando.set(false);
          },
        });
    } else if (tab === 2) {
      // Caja y medios de pago
      this.reportesApi.obtenerCajaMedios({ fecha_inicio: fInicio, fecha_fin: fFin }).subscribe({
        next: (data) => {
          this.cajaMediosData.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte de caja.');
          this.cargando.set(false);
        },
      });
    } else if (tab === 3) {
      // Inventario
      this.reportesApi
        .obtenerInventario({
          categoria: this.filtroCategoria() || undefined,
        })
        .subscribe({
          next: (data) => {
            this.inventarioData.set(data);
            this.cargando.set(false);
          },
          error: (err) => {
            this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte de inventario.');
            this.cargando.set(false);
          },
        });
    } else if (tab === 4) {
      // Gastos
      this.reportesApi.obtenerGastos({ fecha_inicio: fInicio, fecha_fin: fFin }).subscribe({
        next: (data) => {
          this.gastosData.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte de gastos.');
          this.cargando.set(false);
        },
      });
    } else if (tab === 5) {
      // Rentabilidad
      this.reportesApi
        .obtenerRentabilidad({
          fecha_inicio: fInicio,
          fecha_fin: fFin,
          categoria: this.filtroCategoria() || undefined,
        })
        .subscribe({
          next: (data) => {
            this.rentabilidadData.set(data);
            this.cargando.set(false);
          },
          error: (err) => {
            this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte de rentabilidad.');
            this.cargando.set(false);
          },
        });
    } else if (tab === 6) {
      // Operación
      this.reportesApi.obtenerOperacion({ fecha_inicio: fInicio, fecha_fin: fFin }).subscribe({
        next: (data) => {
          this.operacionData.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMensaje.set(err?.error?.message || 'Error al cargar el reporte operativo.');
          this.cargando.set(false);
        },
      });
    }
  }

  // --- EXPORTACIONES A CSV / EXCEL ---
  exportarReporteActual(): void {
    const tab = this.tabActivaIndex();
    const periodo = { inicio: this.fechaInicio(), fin: this.fechaFin() };

    if (tab === 0) {
      const d = this.dashboardData();
      if (!d) return;
      const encabezados = ['Indicador', 'Valor', 'Detalle'];
      const filas = [
        ['Ventas Totales Facturadas', d.kpis.total_ventas, 'Cuentas con estado emitida'],
        ['Ventas Netas (sin propina)', d.kpis.ventas_netas, 'Base gravable / ingresos producto'],
        ['Total Propinas Recaudadas', d.kpis.total_propinas, 'Propinas voluntarias'],
        ['Cuentas Pagadas', d.kpis.cuentas_pagadas, 'Número de facturas'],
        ['Ticket Promedio', d.kpis.ticket_promedio, 'Venta promedio por comanda cobrada'],
        ['Gastos Registrados', d.kpis.total_gastos, 'Egresos menores de caja'],
        ['Balance Operativo', d.kpis.balance_operativo, 'Ventas totales menos gastos'],
        ['Productos con Bajo Stock', d.kpis.productos_bajo_stock, 'Stock entre 1 y 5 unidades'],
        ['Productos Agotados', d.kpis.productos_agotados, 'Stock igual o menor a 0'],
        ['Cajas con Descuadre', d.kpis.cajas_con_diferencia, 'Turnos cerrados con diferencia != 0'],
        ['Monto Total Diferencia Cajas', d.kpis.monto_diferencia_cajas, 'Diferencia neta (sobrantes/faltantes)'],
      ];
      exportarACSV('MesaLista_Resumen_Dashboard', encabezados, filas, 'MesaLista - Resumen Ejecutivo', periodo);
    } else if (tab === 1) {
      const v = this.ventasData();
      if (!v) return;
      const encabezados = [
        'ID Factura',
        'Fecha y Hora',
        'Cliente',
        'Tipo Servicio',
        'Mesa #',
        'Subtotal ($)',
        'Propina ($)',
        'Total Cobrado ($)',
        'Medios de Pago',
        'Atendido Por',
        'Observación',
      ];
      const filas = v.detalle_facturas.map((f) => [
        `FAC-${f.id_venta}`,
        new Date(f.fecha_hora).toLocaleString('es-CO'),
        f.cliente_nombre,
        f.tipo_servicio === 'salon' ? 'Salón / Mesas' : 'Domicilio',
        f.mesa_numero || 'N/A',
        f.subtotal,
        f.propina,
        f.total,
        f.medios_pago,
        f.atendido_por,
        f.observacion || '',
      ]);
      exportarACSV('MesaLista_Reporte_Ventas', encabezados, filas, 'MesaLista - Reporte Detallado de Ventas', periodo);
    } else if (tab === 2) {
      const c = this.cajaMediosData();
      if (!c) return;
      const encabezados = [
        'ID Caja',
        'Estado',
        'Apertura',
        'Cierre',
        'Cajero Apertura',
        'Cajero Cierre',
        'Base Inicial ($)',
        'Ventas Efectivo ($)',
        'Ventas Tarjeta ($)',
        'Ventas Transf. ($)',
        'Total Gastos ($)',
        'Efectivo Teórico ($)',
        'Efectivo Físico ($)',
        'Diferencia ($)',
        'Cuadre',
        'Observaciones',
      ];
      const filas = c.turnos.map((t) => [
        `CAJA-${t.id_caja}`,
        t.estado.toUpperCase(),
        new Date(t.fecha_apertura).toLocaleString('es-CO'),
        t.fecha_cierre ? new Date(t.fecha_cierre).toLocaleString('es-CO') : 'En progreso',
        t.cajero_apertura,
        t.cajero_cierre || 'N/A',
        t.valor_inicial,
        t.ventas_efectivo,
        t.ventas_tarjeta,
        t.ventas_transferencia,
        t.total_gastos,
        t.valor_final_teorico,
        t.valor_final_fisico !== null ? t.valor_final_fisico : 'N/A',
        t.diferencia !== null ? t.diferencia : 'N/A',
        t.tipo_cuadre.toUpperCase(),
        t.observacion || '',
      ]);
      exportarACSV('MesaLista_Reporte_Caja', encabezados, filas, 'MesaLista - Reporte de Caja y Arqueos', periodo);
    } else if (tab === 3) {
      const inv = this.inventarioData();
      if (!inv) return;
      const encabezados = [
        'ID',
        'Producto',
        'Categoría',
        'Controla Stock',
        'Stock Actual',
        'Estado Stock',
        'Costo Unitario ($)',
        'Precio Venta ($)',
        'Valor en Inventario ($)',
        'Disponible en Carta',
      ];
      const filas = this.inventarioFiltrado().map((p) => [
        p.id_producto,
        p.nombre,
        p.categoria,
        p.controla_inventario ? 'SÍ' : 'NO',
        p.cantidad_inventario,
        p.estado_stock.toUpperCase(),
        p.costo_unitario,
        p.precio_venta,
        p.valor_inventario,
        p.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
      ]);
      exportarACSV('MesaLista_Reporte_Inventario', encabezados, filas, 'MesaLista - Reporte de Inventario y Existencias');
    } else if (tab === 4) {
      const g = this.gastosData();
      if (!g) return;
      const encabezados = [
        'ID Gasto',
        'Caja #',
        'Fecha y Hora',
        'Descripción',
        'Tipo de Gasto',
        'Medio de Pago',
        'Total ($)',
        'Responsable',
        'Observación',
      ];
      const filas = g.detalle_gastos.map((x) => [
        x.id_gasto,
        x.id_caja,
        new Date(x.fecha_hora).toLocaleString('es-CO'),
        x.descripcion,
        x.tipo_gasto,
        x.medio_pago,
        x.total,
        x.responsable,
        x.observacion || '',
      ]);
      exportarACSV('MesaLista_Reporte_Gastos', encabezados, filas, 'MesaLista - Reporte de Gastos Operativos', periodo);
    } else if (tab === 5) {
      const r = this.rentabilidadData();
      if (!r) return;
      const encabezados = [
        'ID',
        'Producto',
        'Categoría',
        'Unidades Vendidas',
        'Ingresos Totales ($)',
        'Costo Unitario Vigente ($)',
        'Costo Total Estimado ($)',
        'Utilidad Bruta ($)',
        'Margen Bruto (%)',
      ];
      const filas = r.productos.map((p) => [
        p.id_producto,
        p.nombre,
        p.categoria,
        p.unidades_vendidas,
        p.ingresos_totales,
        p.costo_unitario_actual,
        p.costo_total_estimado,
        p.utilidad_bruta,
        `${p.margen_bruto_porcentaje}%`,
      ]);
      exportarACSV('MesaLista_Reporte_Rentabilidad', encabezados, filas, 'MesaLista - Reporte de Rentabilidad por Producto', periodo);
    } else if (tab === 6) {
      const op = this.operacionData();
      if (!op) return;
      const encabezados = [
        'ID Pedido',
        '# Consecutivo',
        'Fecha y Hora',
        'Tipo Servicio',
        'Mesa #',
        'Usuario',
        'Motivo de Cancelación',
      ];
      const filas = op.pedidos_cancelados_detalle.map((p) => [
        p.id_pedido,
        p.numero_pedido,
        new Date(p.fecha_hora).toLocaleString('es-CO'),
        p.tipo === 'salon' ? 'Salón' : 'Domicilio',
        p.mesa_numero || 'N/A',
        p.usuario,
        p.observacion,
      ]);
      exportarACSV('MesaLista_Reporte_Cancelaciones', encabezados, filas, 'MesaLista - Auditoría de Comandas Canceladas', periodo);
    }
  }

  // --- CÁLCULO DE GRÁFICAS SVG REACTIVAS ---
  obtenerMaximoVentaDia(): number {
    const d = this.dashboardData();
    if (!d || d.graficas.serie_ventas_por_dia.length === 0) return 100000;
    const max = Math.max(...d.graficas.serie_ventas_por_dia.map((s) => s.total_ventas));
    return max > 0 ? max : 100000;
  }

  obtenerMaximoHorario(): number {
    const op = this.operacionData();
    if (!op || op.distribucion_horaria.length === 0) return 10;
    const max = Math.max(...op.distribucion_horaria.map((h) => h.pedidos));
    return max > 0 ? max : 10;
  }

  calcularCoordenadasDonut(): { path: string; color: string; label: string; pct: number }[] {
    const d = this.dashboardData();
    if (!d || d.graficas.distribucion_medios_pago.length === 0) return [];

    const items = d.graficas.distribucion_medios_pago;
    const colores = ['#10B981', '#3B82F6', '#F59E0B'];
    let accumAngle = 0;
    const cx = 100;
    const cy = 100;
    const r = 70;
    const rInner = 45;

    return items.map((it, idx) => {
      const angle = (it.porcentaje / 100) * 360;
      const startAngle = accumAngle;
      const endAngle = accumAngle + angle;
      accumAngle = endAngle;

      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const x3 = cx + rInner * Math.cos(endRad);
      const y3 = cy + rInner * Math.sin(endRad);
      const x4 = cx + rInner * Math.cos(startRad);
      const y4 = cy + rInner * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        path,
        color: colores[idx % colores.length],
        label: it.medio,
        pct: it.porcentaje,
      };
    });
  }
}
