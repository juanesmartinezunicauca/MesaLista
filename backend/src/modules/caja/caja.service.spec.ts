import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CajaService } from './caja.service';

describe('CajaService', () => {
  let service: CajaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      caja: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gasto: {
        create: jest.fn(),
      },
      tipoGasto: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      medioPago: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CajaService>(CajaService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('abrirCaja', () => {
    it('debe abrir una caja exitosamente si no hay otra abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue(null);
      prisma.caja.create.mockResolvedValue({
        id_caja: 1,
        valor_inicial: 100000,
        estado: EstadoCaja.abierta,
        usuarioApertura: { id_usuario: 1, nombre: 'Admin', rol: 'administrador' },
      });

      const resultado = await service.abrirCaja({ valor_inicial: 100000 }, 1);

      expect(resultado).toBeDefined();
      expect(prisma.caja.create).toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si ya hay una caja abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue({
        id_caja: 1,
        fecha_apertura: new Date(),
        estado: EstadoCaja.abierta,
      });

      await expect(service.abrirCaja({ valor_inicial: 50000 }, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('obtenerEstadoActual', () => {
    it('debe retornar abierta: false si no hay caja abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue(null);

      const estado = await service.obtenerEstadoActual();
      expect(estado.abierta).toBe(false);
      expect(estado.caja).toBeNull();
      expect(estado.resumen).toBeNull();
    });

    it('debe calcular métricas, ventas y efectivo esperado correctamente', async () => {
      prisma.caja.findFirst.mockResolvedValue({
        id_caja: 10,
        fecha_apertura: new Date(),
        valor_inicial: 100000,
        usuarioApertura: { nombre: 'Carlos' },
        facturas: [
          {
            id_venta: 1,
            valor_total: 50000,
            propina: 5000,
            fecha_hora: new Date(),
            id_mesa: 1,
            mesa: { numero: 1 },
            usuario: { nombre: 'Mesero 1' },
            pagos: [
              { monto: 50000, medioPago: { nombre: 'Efectivo' } },
            ],
          },
          {
            id_venta: 2,
            valor_total: 30000,
            propina: 0,
            fecha_hora: new Date(),
            id_mesa: 2,
            mesa: { numero: 2 },
            usuario: { nombre: 'Mesero 2' },
            pagos: [
              { monto: 30000, medioPago: { nombre: 'Tarjeta' } },
            ],
          },
        ],
        gastos: [
          {
            id_gasto: 1,
            total: 15000,
            descripcion: 'Hielo',
            fecha_hora: new Date(),
            tipoGasto: { nombre: 'Insumos' },
            medioPago: { nombre: 'Efectivo' },
            usuario: { nombre: 'Admin' },
          },
        ],
      });

      const estado = await service.obtenerEstadoActual();

      expect(estado.abierta).toBe(true);
      expect(estado.resumen?.valor_base).toBe(100000);
      expect(estado.resumen?.total_ventas).toBe(80000);
      expect(estado.resumen?.ventas_efectivo).toBe(50000);
      expect(estado.resumen?.ventas_tarjeta).toBe(30000);
      expect(estado.resumen?.total_gastos).toBe(15000);
      expect(estado.resumen?.gastos_efectivo).toBe(15000);
      // Efectivo esperado: 100.000 (base) + 50.000 (ventas efectivo) - 15.000 (gastos efectivo) = 135.000
      expect(estado.resumen?.efectivo_esperado).toBe(135000);
      expect(estado.movimientos.length).toBe(3);
    });
  });

  describe('registrarGasto', () => {
    it('debe registrar un gasto correctamente en la caja abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: EstadoCaja.abierta });
      prisma.tipoGasto.findUnique.mockResolvedValue({ id_tipo_gasto: 1, nombre: 'Insumos' });
      prisma.medioPago.findUnique.mockResolvedValue({ id_medio_pago: 1, nombre: 'Efectivo' });
      prisma.gasto.create.mockResolvedValue({
        id_gasto: 1,
        total: 20000,
        descripcion: 'Servilletas',
      });

      const resultado = await service.registrarGasto(
        {
          descripcion: 'Servilletas',
          total: 20000,
          tipo_gasto: 'Insumos',
        },
        1,
      );

      expect(resultado).toBeDefined();
      expect(prisma.gasto.create).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si no hay caja abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue(null);

      await expect(
        service.registrarGasto(
          {
            descripcion: 'Insumos',
            total: 10000,
            tipo_gasto: 'Insumos',
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cerrarCaja', () => {
    it('debe calcular la diferencia de arqueo y cerrar la caja', async () => {
      // Simular caja abierta con 100k base
      prisma.caja.findFirst.mockResolvedValue({
        id_caja: 5,
        fecha_apertura: new Date(),
        valor_inicial: 100000,
        usuarioApertura: { nombre: 'Admin' },
        facturas: [],
        gastos: [],
      });

      prisma.caja.update.mockResolvedValue({
        id_caja: 5,
        fecha_apertura: new Date(),
        fecha_cierre: new Date(),
        valor_inicial: 100000,
        usuarioCierre: { nombre: 'Admin' },
      });

      // Efectivo teorico = 100.000. Físico ingresado = 98.000 -> Faltante de 2.000
      const cierre = await service.cerrarCaja({ valor_final_fisico: 98000 }, 1);

      expect(cierre.exito).toBe(true);
      expect(cierre.valor_final_teorico).toBe(100000);
      expect(cierre.valor_final_fisico).toBe(98000);
      expect(cierre.diferencia).toBe(-2000);
      expect(cierre.tipo_cuadre).toBe('faltante');
    });
  });
});
