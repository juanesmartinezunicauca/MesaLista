import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoMesa, EstadoPedido, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PedidosService } from './pedidos.service';

describe('PedidosService', () => {
  let service: PedidosService;
  let prisma: {
    mesa: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    cliente: {
      findUnique: jest.Mock;
    };
    producto: {
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    pedido: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      mesa: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cliente: {
        findUnique: jest.fn(),
      },
      producto: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pedido: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PedidosService>(PedidosService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crear', () => {
    it('debe lanzar BadRequestException si el tipo es salon y no se envia id_mesa', async () => {
      await expect(
        service.crear(
          {
            tipo: TipoPedido.salon,
            items: [{ id_producto: 1, cantidad: 1 }],
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });


    it('debe lanzar NotFoundException si la mesa indicada no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValue(null);

      await expect(
        service.crear(
          {
            tipo: TipoPedido.salon,
            id_mesa: 99,
            items: [{ id_producto: 1, cantidad: 1 }],
          },
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si un producto no existe en la carta', async () => {
      prisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
      });
      prisma.producto.findMany.mockResolvedValue([]); // Ningún producto encontrado

      await expect(
        service.crear(
          {
            tipo: TipoPedido.salon,
            id_mesa: 1,
            items: [{ id_producto: 5, cantidad: 2 }],
          },
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si un producto no esta disponible', async () => {
      prisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
      });
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 5,
          nombre: 'Hamburguesa Especial',
          disponible: false,
          precio_venta: 25000,
        },
      ]);

      await expect(
        service.crear(
          {
            tipo: TipoPedido.salon,
            id_mesa: 1,
            items: [{ id_producto: 5, cantidad: 1 }],
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar cuando un mismo producto repetido en items supera el stock disponible acumulado', async () => {
      prisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
      });
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa Artesanal',
          disponible: true,
          controla_inventario: true,
          cantidad_inventario: 5,
          precio_venta: 20000,
        },
      ]);

      await expect(
        service.crear(
          {
            tipo: TipoPedido.salon,
            id_mesa: 1,
            items: [
              { id_producto: 1, cantidad: 3, ingredientes_removidos: 'Sin cebolla' },
              { id_producto: 1, cantidad: 3, ingredientes_removidos: 'Sin tomate' },
            ],
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe crear el pedido congelando el precio y actualizando la mesa a ocupada', async () => {
      prisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
      });
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Papas Fritas',
          disponible: true,
          precio_venta: 12000,
        },
      ]);
      prisma.pedido.findFirst.mockResolvedValue({ numero_pedido: 3 }); // Último pedido del día fue el 3

      const mockPedidoCreado = {
        id_pedido: 10,
        numero_pedido: 4,
        tipo: TipoPedido.salon,
        estado: EstadoPedido.enviada,
        id_mesa: 1,
        items: [
          {
            id_producto: 1,
            cantidad: 2,
            precio_unitario: 12000,
          },
        ],
      };
      prisma.pedido.create.mockResolvedValue(mockPedidoCreado);

      const res = await service.crear(
        {
          tipo: TipoPedido.salon,
          id_mesa: 1,
          items: [{ id_producto: 1, cantidad: 2 }],
        },
        1,
      );

      expect(prisma.pedido.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            numero_pedido: 4,
            tipo: TipoPedido.salon,
            estado: EstadoPedido.enviada,
            id_mesa: 1,
            items: {
              create: [
                {
                  id_producto: 1,
                  cantidad: 2,
                  ingredientes_removidos: undefined,
                  observacion: undefined,
                  precio_unitario: 12000,
                },
              ],
            },
          }),
        }),
      );
      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 1 },
        data: { estado: EstadoMesa.ocupada },
      });
      expect(res).toEqual(mockPedidoCreado);
    });
  });

  describe('obtenerTodos', () => {
    it('debe retornar pedidos ordenados por fecha descendente', async () => {
      const mockPedidos = [{ id_pedido: 1 }, { id_pedido: 2 }];
      prisma.pedido.findMany.mockResolvedValue(mockPedidos);

      const res = await service.obtenerTodos({ estado: EstadoPedido.enviada });

      expect(prisma.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: EstadoPedido.enviada }),
          orderBy: { fecha_hora: 'desc' },
        }),
      );
      expect(res).toEqual(mockPedidos);
    });
  });

  describe('obtenerPorId', () => {
    it('debe retornar el pedido si existe', async () => {
      const mockPedido = { id_pedido: 1, tipo: TipoPedido.salon };
      prisma.pedido.findUnique.mockResolvedValue(mockPedido);

      const res = await service.obtenerPorId(1);
      expect(res).toEqual(mockPedido);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('obtenerPorMesa', () => {
    it('debe retornar pedidos enviados de la mesa especificada', async () => {
      const mockPedidos = [{ id_pedido: 1, id_mesa: 2, estado: EstadoPedido.enviada }];
      prisma.pedido.findMany.mockResolvedValue(mockPedidos);

      const res = await service.obtenerPorMesa(2);
      expect(prisma.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_mesa: 2, estado: EstadoPedido.enviada },
        }),
      );
      expect(res).toEqual(mockPedidos);
    });
  });

  describe('cambiarEstado', () => {
    it('debe lanzar BadRequestException si el pedido ya fue cerrado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 1,
        estado: EstadoPedido.cerrada,
      });

      await expect(
        service.cambiarEstado(1, { estado: EstadoPedido.cancelada }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe liberar la mesa si se cancela la comanda y no quedan mas comandas activas', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 1,
        id_mesa: 3,
        estado: EstadoPedido.enviada,
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 1,
        id_mesa: 3,
        estado: EstadoPedido.cancelada,
      });
      prisma.pedido.count.mockResolvedValue(0); // Cero pedidos activos restantes

      await service.cambiarEstado(1, { estado: EstadoPedido.cancelada });

      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 3 },
        data: { estado: EstadoMesa.libre },
      });
    });
  });

  describe('cancelar', () => {
    it('debe delegar en cambiarEstado con estado cancelada', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 5,
        estado: EstadoPedido.enviada,
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 5,
        estado: EstadoPedido.cancelada,
      });

      const res = await service.cancelar(5);
      expect(prisma.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_pedido: 5 },
          data: { estado: EstadoPedido.cancelada },
        }),
      );
      expect(res.estado).toBe(EstadoPedido.cancelada);
    });
  });

  describe('Integridad de stock concurrente y máquina de estados', () => {
    it('debe rechazar crear pedido si el decremento condicional de stock falla por concurrencia (count === 0)', async () => {
      prisma.mesa.findUnique.mockResolvedValue({ id_mesa: 1, numero: 1, estado: EstadoMesa.libre });
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Cerveza',
          disponible: true,
          controla_inventario: true,
          cantidad_inventario: 2,
          precio_venta: 8000,
        },
      ]);
      prisma.producto.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.crear({ tipo: TipoPedido.salon, id_mesa: 1, items: [{ id_producto: 1, cantidad: 2 }] }, 1),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.pedido.create).not.toHaveBeenCalled();
    });

    it('debe impedir cerrar manualmente una comanda que no tiene factura emitida (id_factura = null)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 10,
        id_factura: null,
        estado: EstadoPedido.enviada,
        items: [],
      });

      await expect(
        service.cambiarEstado(10, { estado: EstadoPedido.cerrada }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe impedir cancelar desde pedidos una comanda que ya tiene factura emitida', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 11,
        id_factura: 99,
        factura: { estado: 'emitida' },
        estado: EstadoPedido.enviada,
        items: [],
      });

      await expect(
        service.cambiarEstado(11, { estado: EstadoPedido.cancelada }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe impedir reabrir un pedido cancelado vía actualizar (previene devolución duplicada de stock)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 12,
        estado: EstadoPedido.cancelada,
        id_factura: null,
      });

      await expect(
        service.actualizar(12, { estado: EstadoPedido.enviada }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
