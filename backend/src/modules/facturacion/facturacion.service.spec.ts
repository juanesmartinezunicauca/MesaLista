import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoCaja, EstadoFactura, EstadoPedido, RolUsuario } from '@prisma/client';
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

    it('debe incluir el costo de envío [ENVIO: XXXX] en el subtotal y total al facturar un domicilio', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: EstadoCaja.abierta });
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 20,
        id_factura: null,
        estado: EstadoPedido.enviada,
        cliente_nombre: 'Juan Pérez',
        observacion: '[PAGO: Transferencia] [ENVIO: 4000] [ZONA: Bolívar (Zona Centro)]',
        items: [{ id_producto: 1, cantidad: 1, precio_unitario: 20000 }],
      });
      prisma.factura.create.mockResolvedValue({ id_venta: 55 });
      prisma.medioPago.findUnique.mockResolvedValue({ id_medio_pago: 2, nombre: 'Transferencia' });
      prisma.pago.create.mockResolvedValue({});
      prisma.pedido.updateMany.mockResolvedValue({ count: 1 });
      prisma.factura.findUnique.mockResolvedValue({
        id_venta: 55,
        valor: 24000,
        valor_total: 24000,
      });

      await service.crearFactura(
        {
          id_pedido: 20,
          pagos: [{ medio_pago: 'Transferencia', monto: 24000 }],
          cerrar_pedido: false,
        },
        1,
      );

      expect(prisma.factura.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valor: expect.anything(),
            valor_total: expect.anything(),
          }),
        }),
      );
      const createData = prisma.factura.create.mock.calls[0][0].data;
      expect(Number(createData.valor)).toBe(24000);
      expect(Number(createData.valor_total)).toBe(24000);
    });

    it('debe permitir venta directa con propina descontando la propina del subtotal', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: EstadoCaja.abierta });
      prisma.factura.create.mockResolvedValue({ id_venta: 60 });
      prisma.medioPago.findUnique.mockResolvedValue({ id_medio_pago: 1, nombre: 'Efectivo' });
      prisma.pago.create.mockResolvedValue({});
      prisma.factura.findUnique.mockResolvedValue({ id_venta: 60, valor: 20000, propina: 2000, valor_total: 22000 });

      await service.crearFactura(
        {
          propina: 2000,
          pagos: [{ medio_pago: 'Efectivo', monto: 22000 }],
        },
        1,
      );

      const createData = prisma.factura.create.mock.calls[0][0].data;
      expect(Number(createData.valor)).toBe(20000);
      expect(Number(createData.propina)).toBe(2000);
      expect(Number(createData.valor_total)).toBe(22000);
    });

    it('debe lanzar ConflictException si se intenta facturar un pedido que ya tiene factura (previene bypass de rol)', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: EstadoCaja.abierta });
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 25,
        id_factura: 99,
        estado: EstadoPedido.enviada,
        items: [{ id_producto: 1, cantidad: 1, precio_unitario: 15000 }],
      });

      await expect(
        service.crearFactura(
          { id_pedido: 25, pagos: [{ medio_pago: 'Efectivo', monto: 15000 }] },
          3,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar ConflictException si un pedido fue facturado concurrentemente (updateMany count !== pedidos.length)', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: EstadoCaja.abierta });
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 26,
        id_factura: null,
        estado: EstadoPedido.enviada,
        items: [{ id_producto: 1, cantidad: 1, precio_unitario: 15000 }],
      });
      prisma.factura.create.mockResolvedValue({ id_venta: 61 });
      prisma.medioPago.findUnique.mockResolvedValue({ id_medio_pago: 1, nombre: 'Efectivo' });
      prisma.pago.create.mockResolvedValue({});
      prisma.pedido.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.crearFactura(
          { id_pedido: 26, pagos: [{ medio_pago: 'Efectivo', monto: 15000 }] },
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe prohibir a un cajero modificar precio_unitario distinto al del catálogo al actualizar factura', async () => {
      prisma.factura.findUnique.mockResolvedValue({
        id_venta: 70,
        estado: EstadoFactura.emitida,
        valor: 20000,
        propina: 0,
        valor_total: 20000,
        id_caja: 1,
        id_mesa: 1,
        id_usuario: 1,
        caja: { id_caja: 1, estado: EstadoCaja.abierta },
        pagos: [{ id_pago: 1, monto: 20000, medioPago: { nombre: 'Efectivo' } }],
        pedidos: [{ id_pedido: 30, observacion: null, items: [{ id_producto: 1, cantidad: 1 }] }],
      });
      prisma.producto.findMany = jest.fn().mockResolvedValue([
        { id_producto: 1, nombre: 'Hamburguesa', precio_venta: 20000, controla_inventario: false },
      ]);
      prisma.itemPedido = { deleteMany: jest.fn(), create: jest.fn() };

      await expect(
        service.actualizarFactura(
          70,
          { items: [{ id_producto: 1, cantidad: 1, precio_unitario: 0 }] },
          { id_usuario: 2, rol: RolUsuario.cajero },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe rechazar filtro estado inválido en obtenerTodas', async () => {
      await expect(service.obtenerTodas({ estado: 'invalido' })).rejects.toThrow(BadRequestException);
    });
  });
});
