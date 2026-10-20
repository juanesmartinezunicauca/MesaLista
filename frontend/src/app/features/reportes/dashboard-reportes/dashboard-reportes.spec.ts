import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DashboardReportesComponent } from './dashboard-reportes';
import {
  DashboardReporteResponse,
  InventarioReporteResponse,
  ReportesApiService,
  VentasReporteResponse,
} from '../../../core/services/api/reportes-api.service';

describe('DashboardReportesComponent', () => {
  let component: DashboardReportesComponent;
  let fixture: ComponentFixture<DashboardReportesComponent>;

  const mockDashboard: DashboardReporteResponse = {
    periodo: {
      inicio: '2026-10-01T00:00:00.000Z',
      fin: '2026-10-31T23:59:59.999Z',
    },
    kpis: {
      total_ventas: 1500000,
      ventas_netas: 1350000,
      total_propinas: 150000,
      cuentas_pagadas: 30,
      ticket_promedio: 50000,
      total_gastos: 200000,
      balance_operativo: 1300000,
      productos_bajo_stock: 2,
      productos_agotados: 1,
      cajas_con_diferencia: 0,
      monto_diferencia_cajas: 0,
      caja_activa_abierta: true,
      id_caja_activa: 5,
    },
    comparativa: {
      total_ventas_anterior: 1200000,
      cuentas_pagadas_anterior: 25,
      variacion_ventas_porcentaje: 25.0,
      variacion_cuentas_porcentaje: 20.0,
    },
    graficas: {
      serie_ventas_por_dia: [
        { fecha: '2026-10-01', total_ventas: 500000, cuentas_pagadas: 10 },
        { fecha: '2026-10-02', total_ventas: 1000000, cuentas_pagadas: 20 },
      ],
      top_productos: [
        { id_producto: 1, nombre: 'Pizza Margarita', categoria: 'Pizzas', unidades: 15, total: 450000 },
      ],
      distribucion_medios_pago: [
        { medio: 'Efectivo', total: 900000, porcentaje: 60 },
        { medio: 'Tarjeta', total: 600000, porcentaje: 40 },
      ],
      distribucion_servicio: [
        { tipo: 'salon', etiqueta: 'Salón', total: 1000000, porcentaje: 66.7 },
        { tipo: 'domicilio', etiqueta: 'Domicilios', total: 500000, porcentaje: 33.3 },
      ],
    },
  };

  const mockInventario: InventarioReporteResponse = {
    resumen: {
      total_productos: 3,
      total_disponibles: 3,
      total_controlan_stock: 3,
      total_bajo_stock: 1,
      total_agotados: 1,
      valor_total_inventario: 50000,
      valor_potencial_venta: 100000,
    },
    productos: [
      {
        id_producto: 1,
        nombre: 'Cerveza Corona',
        categoria: 'Bebidas',
        controla_inventario: true,
        cantidad_inventario: 2,
        disponible: true,
        costo_unitario: 3500,
        precio_venta: 7000,
        valor_inventario: 7000,
        estado_stock: 'bajo',
      },
      {
        id_producto: 2,
        nombre: 'Gaseosa Postobón',
        categoria: 'Bebidas',
        controla_inventario: true,
        cantidad_inventario: 0,
        disponible: false,
        costo_unitario: 1500,
        precio_venta: 3000,
        valor_inventario: 0,
        estado_stock: 'agotado',
      },
      {
        id_producto: 3,
        nombre: 'Pizza Familiar',
        categoria: 'Pizzas',
        controla_inventario: true,
        cantidad_inventario: 20,
        disponible: true,
        costo_unitario: 10000,
        precio_venta: 25000,
        valor_inventario: 200000,
        estado_stock: 'normal',
      },
    ],
    ajustes_recientes: [],
  };

  const fakeReportesApi = {
    obtenerDashboard: () => of(mockDashboard),
    obtenerVentas: () =>
      of({
        periodo: mockDashboard.periodo,
        resumen: {
          total_ventas: 1500000,
          subtotal: 1350000,
          total_propinas: 150000,
          cuentas_pagadas: 30,
          ticket_promedio: 50000,
          total_salon: 1000000,
          total_domicilio: 500000,
          porcentaje_salon: 66.7,
          porcentaje_domicilio: 33.3,
        },
        serie_temporal: mockDashboard.graficas.serie_ventas_por_dia,
        categorias: [{ categoria: 'Pizzas', total: 1000000, unidades: 20, porcentaje: 66.7 }],
        ranking_productos: [],
        detalle_facturas: [],
      } as VentasReporteResponse),
    obtenerCajaMedios: () =>
      of({
        periodo: mockDashboard.periodo,
        resumen: {
          total_recaudo: 1500000,
          total_efectivo_esperado_neto: 800000,
          total_cajas_analizadas: 2,
          total_cajas_cerradas: 2,
          cajas_exactas: 2,
          cajas_sobrantes: 0,
          cajas_faltantes: 0,
          suma_diferencias: 0,
        },
        desglose_medios: [],
        turnos: [],
      }),
    obtenerInventario: () => of(mockInventario),
    obtenerGastos: () =>
      of({
        periodo: mockDashboard.periodo,
        resumen: { total_gastos: 200000, cantidad_movimientos: 3, gasto_promedio: 66667 },
        desglose_por_tipo: [],
        desglose_por_medio: [],
        detalle_gastos: [],
      }),
    obtenerRentabilidad: () =>
      of({
        periodo: mockDashboard.periodo,
        nota_metodologica: 'Prueba',
        resumen: {
          total_ingresos: 1000000,
          total_costos_estimados: 400000,
          utilidad_bruta_total: 600000,
          margen_bruto_promedio_porcentaje: 60,
        },
        productos: [],
      }),
    obtenerOperacion: () =>
      of({
        periodo: mockDashboard.periodo,
        resumen: {
          total_pedidos: 35,
          pedidos_enviados_activos: 2,
          pedidos_cerrados: 30,
          pedidos_cancelados: 3,
          tasa_cancelacion_porcentaje: 8.5,
          pedidos_salon: 25,
          pedidos_domicilio: 10,
        },
        distribucion_horaria: [],
        top_productos_cocina: [],
        pedidos_cancelados_detalle: [],
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardReportesComponent],
      providers: [
        provideHttpClient(),
        { provide: ReportesApiService, useValue: fakeReportesApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardReportesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse exitosamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe cargar el dashboard por defecto al inicializar', () => {
    expect(component.dashboardData()).toEqual(mockDashboard);
    expect(component.cargando()).toBe(false);
    expect(component.presetSeleccionado()).toBe('mes');
  });

  it('debe cambiar de preset a "hoy" y actualizar fechas', () => {
    component.aplicarPresetFechas('hoy');
    expect(component.presetSeleccionado()).toBe('hoy');
    expect(component.fechaInicio()).toBe(component.fechaFin());
  });

  it('debe cambiar de tab a "Inventario" (index 3) y filtrar existencias', () => {
    component.cambiarTab(3);
    expect(component.tabActivaIndex()).toBe(3);
    expect(component.inventarioData()).toEqual(mockInventario);

    // Filtrar solo agotados
    component.filtroStock.set('agotado');
    const filtrados = component.inventarioFiltrado();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Gaseosa Postobón');
  });

  it('debe calcular coordenadas de Donut para medios de pago', () => {
    const coords = component.calcularCoordenadasDonut();
    expect(coords.length).toBe(2);
    expect(coords[0].label).toBe('Efectivo');
    expect(coords[0].pct).toBe(60);
  });
});
