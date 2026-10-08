import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoPedido, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomiciliosService } from './domicilios.service';

describe('DomiciliosService', () => {
  let service: DomiciliosService;
  let prisma: {
    cliente: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    producto: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    pedido: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      producto: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      pedido: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomiciliosService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DomiciliosService>(DomiciliosService);
  });

  describe('crear', () => {
    const dto = {
      cliente: {
        nombre: 'Andrea Pérez',
        telefono: '3101234567',
        direccion: 'Calle 5 # 10-20',
      },
      items: [
        {
          id_producto: 1,
          cantidad: 2,
        },
      ],
      observacion: 'Sin salsas',
    };

    it('debe registrar un nuevo cliente y crear el pedido a domicilio correctamente', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa',
          disponible: true,
          controla_inventario: true,
          cantidad_inventario: 10,
          precio_venta: 18000,
        },
      ]);
      prisma.cliente.findFirst.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({
        id_cliente: 1,
        nombre: 'Andrea Pérez',
        telefono: '3101234567',
        direccion: 'Calle 5 # 10-20',
      });
      prisma.pedido.findFirst.mockResolvedValue(null); // último pedido consecutivo
      prisma.pedido.create.mockResolvedValue({
        id_pedido: 101,
        numero_pedido: 1,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [
          {
            id_producto: 1,
            cantidad: 2,
            precio_unitario: 18000,
          },
        ],
      });

      const result = await service.crear(dto, 1);

      expect(prisma.cliente.create).toHaveBeenCalled();
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: { decrement: 2 } },
      });
      expect(result.id_pedido).toBe(101);
      expect(result.etapaOperativa).toBe('En Preparación');
      expect(result.totalCalculado).toBe(36000);
    });

    it('debe actualizar la dirección si el cliente ya existe', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa',
          disponible: true,
          controla_inventario: false,
          precio_venta: 18000,
        },
      ]);
      prisma.cliente.findFirst.mockResolvedValue({
        id_cliente: 2,
        nombre: 'Andrea P.',
        telefono: '3101234567',
        direccion: 'Antigua Calle',
      });
      prisma.cliente.update.mockResolvedValue({
        id_cliente: 2,
        nombre: 'Andrea Pérez',
        telefono: '3101234567',
        direccion: 'Calle 5 # 10-20',
      });
      prisma.pedido.create.mockResolvedValue({
        id_pedido: 102,
        numero_pedido: 2,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });

      await service.crear(dto, 1);

      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id_cliente: 2 },
        data: { nombre: 'Andrea Pérez', direccion: 'Calle 5 # 10-20' },
      });
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      prisma.producto.findMany.mockResolvedValue([]);

      await expect(service.crear(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el producto no está disponible', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa',
          disponible: false,
        },
      ]);

      await expect(service.crear(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el stock es insuficiente', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa',
          disponible: true,
          controla_inventario: true,
          cantidad_inventario: 1,
        },
      ]);

      await expect(service.crear(dto, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('obtenerTodos', () => {
    it('debe listar los pedidos y calcular la etapa operativa', async () => {
      prisma.pedido.findMany.mockResolvedValue([
        {
          id_pedido: 1,
          estado: EstadoPedido.enviada,
          observacion: '[EN REPARTO] Rápido',
          items: [{ cantidad: 1, precio_unitario: 20000 }],
        },
        {
          id_pedido: 2,
          estado: EstadoPedido.cerrada,
          observacion: null,
          items: [{ cantidad: 2, precio_unitario: 15000 }],
        },
      ]);

      const result = await service.obtenerTodos();

      expect(result.length).toBe(2);
      expect(result[0].etapaOperativa).toBe('En Reparto');
      expect(result[0].totalCalculado).toBe(20000);
      expect(result[1].etapaOperativa).toBe('Entregado');
      expect(result[1].totalCalculado).toBe(30000);
    });
  });

  describe('buscarClientes', () => {
    it('debe retornar lista de clientes que coinciden con el teléfono', async () => {
      prisma.cliente.findMany.mockResolvedValue([
        { id_cliente: 1, nombre: 'Carlos', telefono: '3123456789', direccion: 'Cra 4' },
      ]);

      const result = await service.buscarClientes('312');

      expect(result.length).toBe(1);
      expect(result[0].nombre).toBe('Carlos');
    });
  });

  describe('cambiarEstado y cancelar', () => {
    it('debe marcar pedido como En Reparto agregando la etiqueta en observacion', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 5,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        observacion: 'Tocar timbre',
        items: [],
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 5,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        observacion: '[EN REPARTO] Tocar timbre',
        items: [],
      });

      const result = await service.cambiarEstado(5, { estado: 'En Reparto' });

      expect(prisma.pedido.update).toHaveBeenCalledWith({
        where: { id_pedido: 5 },
        data: { observacion: '[EN REPARTO] Tocar timbre' },
        include: expect.any(Object),
      });
      expect(result.etapaOperativa).toBe('En Reparto');
    });

    it('debe cancelar el pedido y devolver stock a inventario', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 6,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [
          {
            id_producto: 1,
            cantidad: 3,
            producto: { controla_inventario: true },
          },
        ],
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 6,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.cancelada,
        items: [],
      });

      const result = await service.cancelar(6, 'Cliente no contesta');

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: { increment: 3 } },
      });
      expect(result.etapaOperativa).toBe('Cancelado');
    });

    it('debe registrar el nombre y teléfono del repartidor al cambiar a En Reparto', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 7,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        observacion: '[PENDIENTE] Hamburguesa sin cebolla',
        items: [],
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 7,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        observacion: '[EN REPARTO] [REPARTIDOR: Carlos Gómez | TEL: 3110001122] Hamburguesa sin cebolla',
        items: [],
      });

      const result = await service.cambiarEstado(7, {
        estado: 'En Reparto',
        repartidor_nombre: 'Carlos Gómez',
        repartidor_telefono: '3110001122',
      });

      expect(prisma.pedido.update).toHaveBeenCalledWith({
        where: { id_pedido: 7 },
        data: {
          observacion: '[EN REPARTO] [REPARTIDOR: Carlos Gómez | TEL: 3110001122] Hamburguesa sin cebolla',
        },
        include: expect.any(Object),
      });
      expect(result.etapaOperativa).toBe('En Reparto');
      expect(result.repartidor).toEqual({
        nombre: 'Carlos Gómez',
        telefono: '3110001122',
      });
    });

    it('debe truncar la observación si la combinación excede 255 caracteres', async () => {
      const longNote = 'A'.repeat(240);
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 8,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        observacion: longNote,
        items: [],
      });
      prisma.pedido.update.mockImplementation(({ data }) =>
        Promise.resolve({
          id_pedido: 8,
          tipo: TipoPedido.domicilio,
          estado: EstadoPedido.enviada,
          observacion: data.observacion,
          items: [],
        }),
      );

      await service.cambiarEstado(8, {
        estado: 'En Reparto',
        repartidor_nombre: 'Juancho Motociclista Profesional',
        repartidor_telefono: '3001234567',
      });

      const updateCall = prisma.pedido.update.mock.calls[0][0];
      expect(updateCall.data.observacion.length).toBeLessThanOrEqual(255);
    });
  });
});
