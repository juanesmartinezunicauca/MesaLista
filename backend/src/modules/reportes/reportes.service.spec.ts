import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodoReporte } from './dto';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      factura: {
        findMany: jest.fn(),
      },
      gasto: {
        findMany: jest.fn(),
      },
      caja: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ReportesService>(ReportesService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('calcularRangoFechas', () => {
    it('debe calcular el rango de "hoy" correctamente', () => {
      const rango = service.calcularRangoFechas({ periodo: PeriodoReporte.HOY });
      expect(rango.inicio).toBeDefined();
      expect(rango.fin).toBeDefined();
      expect(rango.etiqueta).toContain('Hoy');
      expect(rango.inicio.getTime()).toBeLessThan(rango.fin.getTime());
    });

    it('debe calcular el rango de "semana" correctamente', () => {
      const rango = service.calcularRangoFechas({ periodo: PeriodoReporte.SEMANA });
      expect(rango.etiqueta).toContain('Últimos 7 días');
      expect(rango.inicio.getTime()).toBeLessThan(rango.fin.getTime());
    });

    it('debe calcular el rango de "mes" correctamente', () => {
      const rango = service.calcularRangoFechas({ periodo: PeriodoReporte.MES });
      expect(rango.etiqueta).toContain('Este Mes');
      expect(rango.inicio.getTime()).toBeLessThan(rango.fin.getTime());
    });

    it('debe calcular el rango personalizado correctamente', () => {
      const rango = service.calcularRangoFechas({
        periodo: PeriodoReporte.PERSONALIZADO,
        fecha_inicio: '2026-09-01',
        fecha_fin: '2026-09-15',
      });
      expect(rango.etiqueta).toContain('2026-09-01 a 2026-09-15');
      expect(rango.inicio.getTime()).toBeLessThan(rango.fin.getTime());
    });

    it('debe lanzar BadRequestException si falta fecha en rango personalizado', () => {
      expect(() =>
        service.calcularRangoFechas({
          periodo: PeriodoReporte.PERSONALIZADO,
          fecha_inicio: '2026-09-01',
        }),
      ).toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si fecha_inicio es posterior a fecha_fin', () => {
      expect(() =>
        service.calcularRangoFechas({
          periodo: PeriodoReporte.PERSONALIZADO,
          fecha_inicio: '2026-09-20',
          fecha_fin: '2026-09-10',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('obtenerResumenEjecutivo', () => {
    it('debe calcular métricas consolidadas, canales y márgenes correctamente', async () => {
      prisma.factura.findMany.mockResolvedValue([
        {
          id_venta: 1,
          id_mesa: 2,
          id_cliente: null,
          valor: 50000,
          propina: 5000,
          valor_total: 55000,
          fecha_hora: new Date('2026-09-29T14:30:00.000Z'),
          mesa: { id_mesa: 2, numero: 2 },
          cliente: null,
          usuario: { id_usuario: 1, nombre: 'Admin' },
          pagos: [
            { monto: 55000, medioPago: { nombre: 'Efectivo' } },
          ],
          pedidos: [
            {
              id_pedido: 10,
              items: [
                {
                  id_item: 1,
                  id_producto: 101,
                  cantidad: 2,
                  precio_unitario: 25000,
                  producto: {
                    id_producto: 101,
                    nombre: 'Pizza Especial',
                    categoria: 'Pizzas',
                    costo: 12000,
                    precio_venta: 25000,
                  },
                },
              ],
            },
          ],
        },
        {
          id_venta: 2,
          id_mesa: null,
          id_cliente: 5,
          valor: 30000,
          propina: 0,
          valor_total: 30000,
          fecha_hora: new Date('2026-09-29T16:00:00.000Z'),
          mesa: null,
          cliente: { id_cliente: 5, nombre: 'Carlos Ruiz' },
          usuario: { id_usuario: 2, nombre: 'Cajero' },
          pagos: [
            { monto: 30000, medioPago: { nombre: 'Transferencia' } },
          ],
          pedidos: [
            {
              id_pedido: 11,
              items: [
                {
                  id_item: 2,
                  id_producto: 102,
                  cantidad: 1,
                  precio_unitario: 30000,
                  producto: {
                    id_producto: 102,
                    nombre: 'Hamburguesa Triple',
                    categoria: 'Hamburguesas',
                    costo: 15000,
                    precio_venta: 30000,
                  },
                },
              ],
            },
          ],
        },
      ]);

      prisma.gasto.findMany.mockResolvedValue([
        {
          id_gasto: 1,
          total: 10000,
          fecha_hora: new Date('2026-09-29T15:00:00.000Z'),
          descripcion: 'Compra de gaseosas',
          tipoGasto: { nombre: 'Insumos' },
          medioPago: { nombre: 'Efectivo' },
          usuario: { id_usuario: 1, nombre: 'Admin' },
        },
      ]);

      const resultado = await service.obtenerResumenEjecutivo({
        periodo: PeriodoReporte.HOY,
      });

      // Ingresos: 55000 + 30000 = 85000
      expect(resultado.kpis.ingresos_totales).toBe(85000);
      expect(resultado.kpis.subtotal_ventas).toBe(80000);
      expect(resultado.kpis.total_propinas).toBe(5000);
      expect(resultado.kpis.total_gastos).toBe(10000);
      expect(resultado.kpis.utilidad_neta).toBe(75000);

      // Costo mercancia: (2 * 12000) + (1 * 15000) = 24000 + 15000 = 39000
      expect(resultado.kpis.costo_mercancia_vendida).toBe(39000);
      expect(resultado.kpis.margen_bruto).toBe(80000 - 39000);
      expect(resultado.kpis.total_facturas).toBe(2);
      expect(resultado.kpis.ticket_promedio).toBe(42500);

      // Canales
      expect(resultado.canales.salon.total).toBe(55000);
      expect(resultado.canales.domicilio.total).toBe(30000);

      // Medios de pago
      expect(resultado.medios_pago.length).toBe(2);
      const ef = resultado.medios_pago.find((m) => m.nombre === 'Efectivo');
      expect(ef?.monto).toBe(55000);

      // Top productos
      expect(resultado.top_productos.length).toBe(2);
      expect(resultado.top_productos[0].nombre).toBe('Pizza Especial');
      expect(resultado.top_productos[0].cantidad_vendida).toBe(2);
    });
  });

  describe('obtenerHistorialTurnosCaja', () => {
    it('debe mapear el historial de cajas con diferencias', async () => {
      prisma.caja.findMany.mockResolvedValue([
        {
          id_caja: 1,
          fecha_apertura: new Date('2026-09-29T10:00:00.000Z'),
          fecha_cierre: new Date('2026-09-29T22:00:00.000Z'),
          estado: 'cerrada',
          valor_inicial: 100000,
          valor_final_teorico: 450000,
          valor_final_fisico: 450000,
          diferencia: 0,
          usuarioApertura: { id_usuario: 1, nombre: 'Admin', rol: 'administrador' },
          usuarioCierre: { id_usuario: 1, nombre: 'Admin', rol: 'administrador' },
          _count: { facturas: 12, gastos: 2 },
        },
      ]);

      const turnos = await service.obtenerHistorialTurnosCaja(10);
      expect(turnos.length).toBe(1);
      expect(turnos[0].id_caja).toBe(1);
      expect(turnos[0].valor_inicial).toBe(100000);
      expect(turnos[0].diferencia).toBe(0);
      expect(turnos[0].total_facturas).toBe(12);
    });
  });

  describe('exportarReporteCsv', () => {
    it('debe generar una cadena CSV válida con cabeceras y métricas', async () => {
      prisma.factura.findMany.mockResolvedValue([]);
      prisma.gasto.findMany.mockResolvedValue([]);

      const csv = await service.exportarReporteCsv({ periodo: PeriodoReporte.HOY });
      expect(csv).toContain('REPORTE EJECUTIVO Y ANALÍTICO - MESALISTA POS');
      expect(csv).toContain('Ingresos Totales');
      expect(csv).toContain('TOP PRODUCTOS MÁS VENDIDOS');
    });
  });
});
