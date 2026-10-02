import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DashboardReportesComponent } from './dashboard-reportes';
import { ReportesApiService } from '../../../core/services/api/reportes-api.service';
import { ResumenReporte, TurnoCajaReporte } from '../../../core/models';

describe('DashboardReportesComponent', () => {
  let component: DashboardReportesComponent;
  let fixture: ComponentFixture<DashboardReportesComponent>;

  const mockResumen: ResumenReporte = {
    periodo: 'hoy',
    etiqueta: 'Hoy (2026-09-29)',
    rango: {
      inicio: '2026-09-29T00:00:00.000-05:00',
      fin: '2026-09-29T23:59:59.999-05:00',
    },
    kpis: {
      ingresos_totales: 85000,
      subtotal_ventas: 80000,
      total_propinas: 5000,
      total_gastos: 15000,
      utilidad_neta: 70000,
      costo_mercancia_vendida: 35000,
      margen_bruto: 45000,
      porcentaje_margen: 56.3,
      total_facturas: 4,
      total_pedidos: 4,
      ticket_promedio: 21250,
    },
    canales: {
      salon: { facturas: 3, total: 60000, porcentaje: 70.6 },
      domicilio: { facturas: 1, total: 25000, porcentaje: 29.4 },
    },
    medios_pago: [
      { nombre: 'Efectivo', monto: 50000, transacciones: 2, porcentaje: 58.8 },
      { nombre: 'Transferencia', monto: 35000, transacciones: 2, porcentaje: 41.2 },
    ],
    top_productos: [
      {
        id_producto: 1,
        nombre: 'Pizza Familiar Luigies',
        categoria: 'Pizzas',
        cantidad_vendida: 3,
        total_recaudado: 60000,
        costo_total: 24000,
        margen_estimado: 36000,
      },
      {
        id_producto: 2,
        nombre: 'Gaseosa Postobón 1.5L',
        categoria: 'Bebidas',
        cantidad_vendida: 2,
        total_recaudado: 12000,
        costo_total: 6000,
        margen_estimado: 6000,
      },
    ],
    desglose_gastos: [
      { categoria: 'Insumos', total: 15000, movimientos: 1, porcentaje: 100 },
    ],
    serie_temporal: [
      { fecha: '14:00', label: '14:00', ingresos: 40000, gastos: 0, pedidos: 2 },
      { fecha: '15:00', label: '15:00', ingresos: 45000, gastos: 15000, pedidos: 2 },
    ],
  };

  const mockTurnos: TurnoCajaReporte[] = [
    {
      id_caja: 1,
      fecha_apertura: '2026-09-29T10:00:00Z',
      fecha_cierre: null,
      estado: 'abierta',
      valor_inicial: 100000,
      valor_final_teorico: null,
      valor_final_fisico: null,
      diferencia: null,
      usuario_apertura: 'Admin',
      usuario_cierre: null,
      total_facturas: 4,
      total_gastos: 1,
    },
  ];

  let reportesApiMock: {
    obtenerResumen: any;
    obtenerTurnosCaja: any;
    descargarCsv: any;
  };

  beforeEach(async () => {
    reportesApiMock = {
      obtenerResumen: vi.fn().mockReturnValue(of(mockResumen)),
      obtenerTurnosCaja: vi.fn().mockReturnValue(of(mockTurnos)),
      descargarCsv: vi.fn().mockReturnValue(of(new Blob(['csv_content'], { type: 'text/csv' }))),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardReportesComponent],
      providers: [
        { provide: ReportesApiService, useValue: reportesApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardReportesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe inicializarse y cargar métricas de resumen y turnos', () => {
    expect(component).toBeTruthy();
    expect(reportesApiMock.obtenerResumen).toHaveBeenCalled();
    expect(reportesApiMock.obtenerTurnosCaja).toHaveBeenCalled();
    expect(component.resumen()).toEqual(mockResumen);
    expect(component.turnosCaja().length).toBe(1);
  });

  it('debe computar KPIs reactivamente', () => {
    const kpis = component.kpis();
    expect(kpis.ingresos_totales).toBe(85000);
    expect(kpis.utilidad_neta).toBe(70000);
    expect(kpis.total_facturas).toBe(4);
    expect(kpis.ticket_promedio).toBe(21250);
  });

  it('debe filtrar productos en la tabla según el texto de búsqueda', () => {
    component.busquedaProducto.set('Pizza');
    expect(component.topProductosFiltrados().length).toBe(1);
    expect(component.topProductosFiltrados()[0].nombre).toContain('Pizza');

    component.busquedaProducto.set('Inexistente');
    expect(component.topProductosFiltrados().length).toBe(0);

    component.busquedaProducto.set('');
    expect(component.topProductosFiltrados().length).toBe(2);
  });

  it('debe cambiar de período y disparar recarga', () => {
    component.cambiarPeriodo('semana');
    expect(component.periodoSeleccionado()).toBe('semana');
    expect(reportesApiMock.obtenerResumen).toHaveBeenCalledTimes(2);
  });

  it('debe validar fechas antes de aplicar rango personalizado', () => {
    const snackBarInstance = (component as any).snackBar;
    const spy = vi.spyOn(snackBarInstance, 'open').mockReturnValue({} as any);

    component.fechaInicio.set('2026-09-30');
    component.fechaFin.set('2026-09-01');
    component.aplicarRangoPersonalizado();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('La fecha inicial no puede ser mayor a la final'),
      'Cerrar',
      expect.any(Object),
    );
  });

  it('debe calcular porcentaje de altura de barras correctamente', () => {
    const altura = component.calcularPorcentajeAltura(45000);
    expect(altura).toBeGreaterThan(0);
    expect(altura).toBeLessThanOrEqual(100);
  });
});
