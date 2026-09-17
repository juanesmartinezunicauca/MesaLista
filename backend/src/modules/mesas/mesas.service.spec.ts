import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoMesa, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MesasService } from './mesas.service';

describe('MesasService', () => {
  let service: MesasService;
  let prisma: {
    mesa: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    pedido: {
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    factura: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      mesa: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      pedido: {
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      factura: {
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MesasService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MesasService>(MesasService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crear', () => {
    it('debe crear una mesa exitosamente con estado libre por defecto', async () => {
      prisma.mesa.findUnique.mockResolvedValue(null);
      const mockCreada = {
        id_mesa: 1,
        numero: 5,
        estado: EstadoMesa.libre,
      };
      prisma.mesa.create.mockResolvedValue(mockCreada);

      const res = await service.crear({ numero: 5 });

      expect(prisma.mesa.findUnique).toHaveBeenCalledWith({
        where: { numero: 5 },
      });
      expect(prisma.mesa.create).toHaveBeenCalledWith({
        data: { numero: 5, estado: EstadoMesa.libre },
      });
      expect(res).toEqual(mockCreada);
    });

    it('debe lanzar ConflictException si el número de mesa ya está registrado', async () => {
      prisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 2,
        numero: 5,
        estado: EstadoMesa.libre,
      });

      await expect(service.crear({ numero: 5 })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.mesa.create).not.toHaveBeenCalled();
    });
  });

  describe('obtenerTodas', () => {
    it('debe retornar lista de mesas ordenadas por número con pedidos activos', async () => {
      const mockMesas = [
        { id_mesa: 1, numero: 1, estado: EstadoMesa.libre, pedidos: [] },
        {
          id_mesa: 2,
          numero: 2,
          estado: EstadoMesa.ocupada,
          pedidos: [{ id_pedido: 10, estado: EstadoPedido.enviada, items: [] }],
        },
      ];
      prisma.mesa.findMany.mockResolvedValue(mockMesas);

      const res = await service.obtenerTodas();

      expect(prisma.mesa.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { numero: 'asc' },
        include: {
          pedidos: {
            where: { estado: EstadoPedido.enviada },
            include: { items: { include: { producto: true } } },
          },
        },
      });
      expect(res).toEqual(mockMesas);
    });

    it('debe filtrar mesas por estado cuando se especifica', async () => {
      prisma.mesa.findMany.mockResolvedValue([]);

      await service.obtenerTodas({ estado: EstadoMesa.ocupada });

      expect(prisma.mesa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { estado: EstadoMesa.ocupada },
        }),
      );
    });
  });

  describe('obtenerPorId', () => {
    it('debe retornar la mesa si existe', async () => {
      const mockMesa = {
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      prisma.mesa.findUnique.mockResolvedValue(mockMesa);

      const res = await service.obtenerPorId(1);
      expect(res).toEqual(mockMesa);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('actualizar', () => {
    it('debe actualizar número y estado exitosamente', async () => {
      const mockMesaExistente = {
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      prisma.mesa.findUnique
        .mockResolvedValueOnce(mockMesaExistente) // obtenerPorId
        .mockResolvedValueOnce(null); // chequeo de número

      const mockActualizada = {
        id_mesa: 1,
        numero: 10,
        estado: EstadoMesa.ocupada,
      };
      prisma.mesa.update.mockResolvedValue(mockActualizada);

      const res = await service.actualizar(1, {
        numero: 10,
        estado: EstadoMesa.ocupada,
      });

      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 1 },
        data: { numero: 10, estado: EstadoMesa.ocupada },
      });
      expect(res).toEqual(mockActualizada);
    });

    it('debe lanzar ConflictException si el nuevo número ya pertenece a otra mesa', async () => {
      const mockMesa1 = {
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      const mockMesa2 = {
        id_mesa: 2,
        numero: 5,
        estado: EstadoMesa.libre,
      };

      prisma.mesa.findUnique
        .mockResolvedValueOnce(mockMesa1) // obtenerPorId
        .mockResolvedValueOnce(mockMesa2); // número 5 ya ocupado por mesa 2

      await expect(
        service.actualizar(1, { numero: 5 }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.mesa.update).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('debe actualizar el estado de la mesa', async () => {
      const mockMesa = {
        id_mesa: 1,
        numero: 1,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      prisma.mesa.findUnique.mockResolvedValue(mockMesa);
      prisma.mesa.update.mockResolvedValue({
        ...mockMesa,
        estado: EstadoMesa.ocupada,
      });

      const res = await service.cambiarEstado(1, {
        estado: EstadoMesa.ocupada,
      });

      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 1 },
        data: { estado: EstadoMesa.ocupada },
      });
      expect(res.estado).toBe(EstadoMesa.ocupada);
    });
  });

  describe('eliminar', () => {
    it('debe lanzar BadRequestException si tiene comandas activas pendientes', async () => {
      const mockMesaConPedidosActivos = {
        id_mesa: 1,
        numero: 3,
        estado: EstadoMesa.ocupada,
        pedidos: [{ id_pedido: 100 }],
      };
      prisma.mesa.findUnique.mockResolvedValue(mockMesaConPedidosActivos);

      await expect(service.eliminar(1)).rejects.toThrow(BadRequestException);
      expect(prisma.mesa.delete).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si tiene historial operativo previo', async () => {
      const mockMesaSinActivos = {
        id_mesa: 1,
        numero: 3,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      prisma.mesa.findUnique.mockResolvedValue(mockMesaSinActivos);
      prisma.pedido.count.mockResolvedValue(4); // 4 pedidos históricos cerrados
      prisma.factura.count.mockResolvedValue(2);

      await expect(service.eliminar(1)).rejects.toThrow(ConflictException);
      expect(prisma.mesa.delete).not.toHaveBeenCalled();
    });

    it('debe eliminar físicamente si no tiene comandas activas ni historial operativo', async () => {
      const mockMesaLimpia = {
        id_mesa: 1,
        numero: 9,
        estado: EstadoMesa.libre,
        pedidos: [],
      };
      prisma.mesa.findUnique.mockResolvedValue(mockMesaLimpia);
      prisma.pedido.count.mockResolvedValue(0);
      prisma.factura.count.mockResolvedValue(0);
      prisma.mesa.delete.mockResolvedValue(mockMesaLimpia);

      const res = await service.eliminar(1);

      expect(prisma.mesa.delete).toHaveBeenCalledWith({
        where: { id_mesa: 1 },
      });
      expect(res).toEqual({
        mensaje: 'La mesa #9 ha sido eliminada exitosamente.',
        id_mesa: 1,
      });
    });
  });

  describe('transferirMesa', () => {
    it('debe lanzar BadRequestException si id_origen e id_destino son iguales', async () => {
      await expect(
        service.transferirMesa({ id_origen: 1, id_destino: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si la mesa origen no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.transferirMesa({ id_origen: 1, id_destino: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si la mesa destino no existe', async () => {
      prisma.mesa.findUnique
        .mockResolvedValueOnce({ id_mesa: 1, numero: 1, estado: EstadoMesa.ocupada })
        .mockResolvedValueOnce(null);

      await expect(
        service.transferirMesa({ id_origen: 1, id_destino: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe transferir correctamente incluso si la mesa origen no tiene pedidos activos registrados', async () => {
      prisma.mesa.findUnique
        .mockResolvedValueOnce({ id_mesa: 1, numero: 1, estado: EstadoMesa.ocupada })
        .mockResolvedValueOnce({ id_mesa: 2, numero: 2, estado: EstadoMesa.libre });
      prisma.pedido.count.mockResolvedValue(0);
      prisma.mesa.update.mockResolvedValue({});

      const res = await service.transferirMesa({ id_origen: 1, id_destino: 2 });
      expect(res.pedidos_transferidos).toBe(0);
      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
      expect(prisma.mesa.update).toHaveBeenCalledTimes(2);
    });

    it('debe transferir pedidos, marcar origen libre y destino ocupada exitosamente', async () => {
      const mesaOrigen = { id_mesa: 1, numero: 1, estado: EstadoMesa.ocupada };
      const mesaDestino = { id_mesa: 2, numero: 2, estado: EstadoMesa.libre };

      prisma.mesa.findUnique
        .mockResolvedValueOnce(mesaOrigen)
        .mockResolvedValueOnce(mesaDestino);
      prisma.pedido.count.mockResolvedValue(3);
      prisma.pedido.updateMany.mockResolvedValue({ count: 3 });
      prisma.mesa.update.mockResolvedValue({});

      const res = await service.transferirMesa({ id_origen: 1, id_destino: 2 });

      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: { id_mesa: 1, estado: EstadoPedido.enviada },
        data: { id_mesa: 2 },
      });
      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 1 },
        data: { estado: EstadoMesa.libre },
      });
      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id_mesa: 2 },
        data: { estado: EstadoMesa.ocupada },
      });
      expect(res.pedidos_transferidos).toBe(3);
    });
  });
});
