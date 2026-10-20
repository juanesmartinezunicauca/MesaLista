import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoCaja, EstadoFactura, EstadoPedido, TipoAjuste, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportesService, resolverRangoFechas } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  let prisma: {
    factura: {
      findMany: jest.Mock;
    };
    gasto: {
      findMany: jest.Mock;
    };
    producto: {
      findMany: jest.Mock;
    };
    caja: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    pedido: {
      findMany: jest.Mock;
    };
    ajusteInventario: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      factura: {
        findMany: jest.fn(),
      },
      gasto: {
        findMany: jest.fn(),
      },
      producto: {
        findMany: jest.fn(),
      },
      caja: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      pedido: {
        findMany: jest.fn(),
      },
      ajusteInventario: {
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

  describe('resolverRangoFechas', () => {
    it('debe arrojar BadRequestException si la fecha_inicio es posterior a fecha_fin', () => {
      expect(() =>
        resolverRangoFechas('2026-10-20', '2026-10-10'),
      ).toThrow(BadRequestException);
    });

    it('debe parsear fechas en formato YYYY-MM-DD cubriendo el día completo en UTC-5', () => {
      const { inicio, fin } = resolverRangoFechas('2026-10-01', '2026-10-05');
      expect(inicio).toBeInstanceOf(Date);
      expect(fin).toBeInstanceOf(Date);
      expect(inicio.getTime()).toBeLessThan(fin.getTime());
    });

    it('debe limpiar espacios en blanco alrededor de las fechas', () => {
      const { inicio, fin } = resolverRangoFechas('  2026-10-01  ', '  2026-10-05  ');
      expect(inicio).toBeInstanceOf(Date);
      expect(fin).toBeInstanceOf(Date);
      expect(inicio.getTime()).toBeLessThan(fin.getTime());
    });
  });

  describe('obtenerDashboard', () => {
    it('debe clasificar correctamente pasarelas colombianas modernas (Bold, Wompi, PSE)', async () => {
      const mockFacturas = [
        {
          id_venta: 2,
          id_mesa: null,
          valor: '80000.00',
          propina: '0.00',
          valor_total: '80000.00',
          fecha_hora: new Date('2026-10-03T12:00:00-05:00'),
          pagos: [
            { monto: '50000.00', medioPago: { nombre: 'Bold Datáfono' } },
            { monto: '30000.00', medioPago: { nombre: 'Wompi PSE' } },
          ],
          pedidos: [],
        },
      ];

      prisma.factura.findMany
        .mockResolvedValueOnce(mockFacturas)
        .mockResolvedValueOnce([]);

      prisma.gasto.findMany.mockResolvedValue([]);
      prisma.producto.findMany.mockResolvedValue([]);
      prisma.caja.findMany.mockResolvedValue([]);
      prisma.caja.findFirst.mockResolvedValue(null);

      const res = await service.obtenerDashboard({ fecha_inicio: '2026-10-01', fecha_fin: '2026-10-05' });
      const medioTarjeta = res.graficas.distribucion_medios_pago.find((m) => m.medio.includes('Tarjeta'));
      const medioTransf = res.graficas.distribucion_medios_pago.find((m) => m.medio.includes('Transferencia'));
      expect(medioTarjeta?.total).toBe(50000);
      expect(medioTransf?.total).toBe(30000);
    });
    it('debe retornar KPIs en cero cuando no existen ventas ni gastos en el periodo', async () => {
      prisma.factura.findMany.mockResolvedValue([]);
      prisma.gasto.findMany.mockResolvedValue([]);
      prisma.producto.findMany.mockResolvedValue([]);
      prisma.caja.findMany.mockResolvedValue([]);
      prisma.caja.findFirst.mockResolvedValue(null);

      const res = await service.obtenerDashboard({
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-05',
      });

      expect(res.kpis.total_ventas).toBe(0);
      expect(res.kpis.cuentas_pagadas).toBe(0);
      expect(res.kpis.ticket_promedio).toBe(0);
      expect(res.kpis.total_gastos).toBe(0);
      expect(res.kpis.balance_operativo).toBe(0);
      expect(res.kpis.productos_bajo_stock).toBe(0);
      expect(res.kpis.productos_agotados).toBe(0);
      expect(res.kpis.cajas_con_diferencia).toBe(0);
    });

    it('debe computar correctamente ventas con pagos mixtos y excluir pedidos sin facturar', async () => {
      const mockFacturas = [
        {
          id_venta: 1,
          id_mesa: 2,
          valor: '45000.00',
          propina: '5000.00',
          valor_total: '50000.00',
          fecha_hora: new Date('2026-10-02T19:30:00-05:00'),
          pagos: [
            { monto: '30000.00', medioPago: { nombre: 'Efectivo' } },
            { monto: '20000.00', medioPago: { nombre: 'Tarjeta' } },
          ],
          pedidos: [
            {
              items: [
                {
                  id_producto: 10,
                  cantidad: 2,
                  precio_unitario: '22500.00',
                  producto: { id_producto: 10, nombre: 'Pizza Especial', categoria: 'Pizzas' },
                },
              ],
            },
          ],
        },
      ];

      prisma.factura.findMany
        .mockResolvedValueOnce(mockFacturas) // Periodo actual
        .mockResolvedValueOnce([]); // Periodo anterior

      prisma.gasto.findMany.mockResolvedValue([
        { total: '15000.00', medioPago: { nombre: 'Efectivo' }, tipoGasto: { nombre: 'Insumos' } },
      ]);

      prisma.producto.findMany.mockResolvedValue([
        { cantidad_inventario: 3, controla_inventario: true }, // Bajo stock
        { cantidad_inventario: 0, controla_inventario: true }, // Agotado
        { cantidad_inventario: 20, controla_inventario: true }, // Normal
      ]);

      prisma.caja.findMany.mockResolvedValue([
        { id_caja: 1, estado: EstadoCaja.cerrada, diferencia: '-2000.00' }, // Faltante
      ]);

      prisma.caja.findFirst.mockResolvedValue({ id_caja: 2, valor_inicial: '100000.00' });

      const res = await service.obtenerDashboard({
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-05',
      });

      expect(res.kpis.total_ventas).toBe(50000);
      expect(res.kpis.ventas_netas).toBe(45000);
      expect(res.kpis.total_propinas).toBe(5000);
      expect(res.kpis.cuentas_pagadas).toBe(1);
      expect(res.kpis.ticket_promedio).toBe(50000);
      expect(res.kpis.total_gastos).toBe(15000);
      expect(res.kpis.balance_operativo).toBe(35000);
      expect(res.kpis.productos_bajo_stock).toBe(1);
      expect(res.kpis.productos_agotados).toBe(1);
      expect(res.kpis.cajas_con_diferencia).toBe(1);
      expect(res.kpis.monto_diferencia_cajas).toBe(-2000);
      expect(res.kpis.caja_activa_abierta).toBe(true);

      // Verificación de medios de pago
      const efectivo = res.graficas.distribucion_medios_pago.find((m) => m.medio === 'Efectivo');
      const tarjeta = res.graficas.distribucion_medios_pago.find((m) => m.medio.includes('Tarjeta'));
      expect(efectivo?.total).toBe(30000);
      expect(tarjeta?.total).toBe(20000);

      // Verificación de top productos
      expect(res.graficas.top_productos[0].nombre).toBe('Pizza Especial');
      expect(res.graficas.top_productos[0].unidades).toBe(2);
    });
  });

  describe('obtenerReporteCajaMedios', () => {
    it('debe categorizar correctamente cajas exactas, con sobrantes y faltantes', async () => {
      prisma.caja.findMany.mockResolvedValue([
        {
          id_caja: 1,
          estado: EstadoCaja.cerrada,
          fecha_apertura: new Date('2026-10-01T14:00:00-05:00'),
          fecha_cierre: new Date('2026-10-01T23:00:00-05:00'),
          valor_inicial: '100000.00',
          valor_final_teorico: '250000.00',
          valor_final_fisico: '250000.00',
          diferencia: '0.00',
          usuarioApertura: { nombre: 'Cajero 1' },
          usuarioCierre: { nombre: 'Cajero 1' },
          facturas: [
            {
              valor_total: '150000.00',
              pagos: [{ monto: '150000.00', medioPago: { nombre: 'Efectivo' } }],
            },
          ],
          gastos: [],
        },
        {
          id_caja: 2,
          estado: EstadoCaja.cerrada,
          fecha_apertura: new Date('2026-10-02T14:00:00-05:00'),
          fecha_cierre: new Date('2026-10-02T23:00:00-05:00'),
          valor_inicial: '100000.00',
          valor_final_teorico: '200000.00',
          valor_final_fisico: '205000.00',
          diferencia: '5000.00', // Sobrante
          usuarioApertura: { nombre: 'Cajero 2' },
          usuarioCierre: { nombre: 'Cajero 2' },
          facturas: [
            {
              valor_total: '100000.00',
              pagos: [{ monto: '100000.00', medioPago: { nombre: 'Efectivo' } }],
            },
          ],
          gastos: [],
        },
      ]);

      const res = await service.obtenerReporteCajaMedios({
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-05',
      });

      expect(res.resumen.total_cajas_cerradas).toBe(2);
      expect(res.resumen.cajas_exactas).toBe(1);
      expect(res.resumen.cajas_sobrantes).toBe(1);
      expect(res.resumen.cajas_faltantes).toBe(0);
      expect(res.resumen.suma_diferencias).toBe(5000);
      expect(res.turnos[0].tipo_cuadre).toBe('exacto');
      expect(res.turnos[1].tipo_cuadre).toBe('sobrante');
    });
  });

  describe('obtenerReporteInventario', () => {
    it('debe valorizar existencias y catalogar estados de stock correctamente', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Gaseosa Postobón 350ml',
          categoria: 'Bebidas',
          costo: '1500.00',
          precio_venta: '3000.00',
          cantidad_inventario: 10,
          controla_inventario: true,
          disponible: true,
        },
        {
          id_producto: 2,
          nombre: 'Cerveza Club Colombia',
          categoria: 'Bebidas',
          costo: '3000.00',
          precio_venta: '6000.00',
          cantidad_inventario: 2, // Bajo stock
          controla_inventario: true,
          disponible: true,
        },
        {
          id_producto: 3,
          nombre: 'Agua Cristal',
          categoria: 'Bebidas',
          costo: '1000.00',
          precio_venta: '2500.00',
          cantidad_inventario: 0, // Agotado
          controla_inventario: true,
          disponible: false,
        },
      ]);

      prisma.ajusteInventario.findMany.mockResolvedValue([]);

      const res = await service.obtenerReporteInventario({});

      expect(res.resumen.total_productos).toBe(3);
      expect(res.resumen.total_bajo_stock).toBe(1);
      expect(res.resumen.total_agotados).toBe(1);
      // Valorización: (10 * 1500) + (2 * 3000) + (0 * 1000) = 15000 + 6000 = 21000
      expect(res.resumen.valor_total_inventario).toBe(21000);
      // Valor potencial venta: (10 * 3000) + (2 * 6000) = 30000 + 12000 = 42000
      expect(res.resumen.valor_potencial_venta).toBe(42000);

      expect(res.productos[0].estado_stock).toBe('normal');
      expect(res.productos[1].estado_stock).toBe('bajo');
      expect(res.productos[2].estado_stock).toBe('agotado');
    });
  });

  describe('obtenerReporteRentabilidad', () => {
    it('debe calcular utilidad y margen bruto basándose en el costo vigente del catálogo', async () => {
      prisma.factura.findMany.mockResolvedValue([
        {
          id_venta: 1,
          estado: EstadoFactura.emitida,
          pedidos: [
            {
              items: [
                {
                  id_producto: 1,
                  cantidad: 4,
                  precio_unitario: '25000.00',
                  producto: {
                    id_producto: 1,
                    nombre: 'Pizza Familiar',
                    categoria: 'Pizzas',
                    costo: '12000.00', // Costo unitario
                  },
                },
              ],
            },
          ],
        },
      ]);

      const res = await service.obtenerReporteRentabilidad({
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-10',
      });

      // Ingresos: 4 * 25000 = 100,000
      // Costos: 4 * 12000 = 48,000
      // Utilidad: 100,000 - 48,000 = 52,000
      // Margen: 52%
      expect(res.resumen.total_ingresos).toBe(100000);
      expect(res.resumen.total_costos_estimados).toBe(48000);
      expect(res.resumen.utilidad_bruta_total).toBe(52000);
      expect(res.resumen.margen_bruto_promedio_porcentaje).toBe(52);
      expect(res.productos[0].utilidad_bruta).toBe(52000);
      expect(res.productos[0].margen_bruto_porcentaje).toBe(52);
      expect(res.nota_metodologica).toContain('costo unitario actualmente registrado');
    });
  });
});
