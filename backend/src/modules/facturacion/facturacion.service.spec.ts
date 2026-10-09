import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoCaja, EstadoFactura, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FacturacionService } from './facturacion.service';

describe('FacturacionService', () => {
  let service: FacturacionService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      caja: {
        findFirst: jest.fn(),
      },
      factura: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      mesa: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      producto: {
        update: jest.fn(),
      },
      pago: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      medioPago: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacturacionService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<FacturacionService>(FacturacionService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('anularFactura', () => {
    it('debe anular exitosamente la factura, cancelar pedidos y restituir existencias de inventario', async () => {
      prisma.factura.findUnique.mockResolvedValue({
        id_venta: 1,
        estado: EstadoFactura.emitida,
        id_caja: 1,
        caja: { id_caja: 1, estado: EstadoCaja.abierta },
        pagos: [],
      });

      prisma.factura.update.mockResolvedValue({
        id_venta: 1,
        estado: EstadoFactura.anulada,
        motivo_anulacion: 'Error en digitación de mesa',
      });

      prisma.pedido.findMany.mockResolvedValue([
        {
          id_pedido: 10,
          id_factura: 1,
          items: [
            {
              id_item: 1,
              id_producto: 5,
              cantidad: 2,
              producto: { id_producto: 5, controla_inventario: true },
            },
          ],
        },
      ]);

      const resultado = await service.anularFactura(1, 'Error en digitación de mesa', 1);

      expect(resultado.exito).toBe(true);
      expect(prisma.factura.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_venta: 1 },
          data: expect.objectContaining({
            estado: EstadoFactura.anulada,
            motivo_anulacion: 'Error en digitación de mesa',
          }),
        }),
      );

      // Restituyó existencias de inventario
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 5 },
        data: {
          cantidad_inventario: { increment: 2 },
        },
      });

      // Marcó pedidos asociados como cancelados
      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: { id_factura: 1 },
        data: { estado: EstadoPedido.cancelada },
      });
    });

    it('debe rechazar anular si la factura no existe', async () => {
      prisma.factura.findUnique.mockResolvedValue(null);

      await expect(service.anularFactura(999, 'Motivo', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe rechazar anular si la factura ya está anulada', async () => {
      prisma.factura.findUnique.mockResolvedValue({
        id_venta: 1,
        estado: EstadoFactura.anulada,
        caja: { estado: EstadoCaja.abierta },
      });

      await expect(service.anularFactura(1, 'Motivo', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar anular si el turno de caja ya fue cerrado', async () => {
      prisma.factura.findUnique.mockResolvedValue({
        id_venta: 1,
        estado: EstadoFactura.emitida,
        id_caja: 2,
        caja: { id_caja: 2, estado: EstadoCaja.cerrada },
      });

      await expect(service.anularFactura(1, 'Motivo', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe exigir un motivo obligatorio de anulación', async () => {
      await expect(service.anularFactura(1, '', 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
