import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoPedido, RolUsuario, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomiciliosService } from './domicilios.service';

describe('DomiciliosService', () => {
  let service: DomiciliosService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
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
    caja: {
      findFirst: jest.Mock;
    };
    factura: {
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id_usuario: 1,
          nombre: 'Personal Restaurante',
          email: 'personal@mesalista.com',
          rol: 'cajero',
        }),
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
      caja: {
        findFirst: jest.fn().mockResolvedValue({ id_caja: 1, estado: 'abierta' }),
      },
      factura: {
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

    it('debe crear el pedido a domicilio con los datos del cliente correctamente', async () => {
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
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Cajero Turno',
        email: 'cajero@test.com',
        rol: 'cajero',
      });
      prisma.pedido.findFirst.mockResolvedValue(null); // último pedido consecutivo
      prisma.pedido.create.mockResolvedValue({
        id_pedido: 101,
        numero_pedido: 1,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        cliente_nombre: 'Andrea Pérez',
        cliente_telefono: '3101234567',
        cliente_direccion: 'Calle 5 # 10-20',
        items: [
          {
            id_producto: 1,
            cantidad: 2,
            precio_unitario: 18000,
          },
        ],
      });

      const result = await service.crear(dto, 1);

      expect(prisma.pedido.create).toHaveBeenCalled();
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: { decrement: 2 } },
      });
      expect(result.id_pedido).toBe(101);
      expect(result.etapaOperativa).toBe('En Preparación');
      expect(result.totalCalculado).toBe(36000);
    });

    it('debe tomar nombre y correo de la sesión si el creador es rol cliente', async () => {
      prisma.producto.findMany.mockResolvedValue([
        {
          id_producto: 1,
          nombre: 'Hamburguesa',
          disponible: true,
          controla_inventario: false,
          precio_venta: 18000,
        },
      ]);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 5,
        nombre: 'Cliente Autenticado',
        email: 'cliente@auth.com',
        rol: RolUsuario.cliente,
      });
      prisma.pedido.create.mockResolvedValue({
        id_pedido: 102,
        numero_pedido: 2,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        cliente_nombre: 'Cliente Autenticado',
        cliente_email: 'cliente@auth.com',
        items: [],
      });

      const result = await service.crear(dto, 5);

      expect(prisma.pedido.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cliente_nombre: 'Cliente Autenticado',
            cliente_email: 'cliente@auth.com',
          }),
        }),
      );
      expect(result.id_pedido).toBe(102);
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

    it('debe anular automáticamente la factura en caja si el pedido cancelado ya estaba facturado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 6,
        id_factura: 15,
        numero_pedido: 105,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 6,
        id_factura: 15,
        numero_pedido: 105,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.cancelada,
        items: [],
      });

      await service.cancelar(6, 'Cliente canceló el pedido');

      expect(prisma.factura.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_venta: 15 },
          data: expect.objectContaining({
            estado: 'anulada',
          }),
        })
      );
    });

    it('debe rechazar marcar como Entregado si el pedido aún no cuenta con factura de cobro', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 7,
        id_factura: null, // Sin factura
        numero_pedido: 106,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });

      await expect(service.cambiarEstado(7, { estado: 'Entregado' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('debe permitir marcar como Entregado si el pedido ya está facturado en caja', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 7,
        id_factura: 20, // Facturado
        numero_pedido: 106,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });
      prisma.pedido.update.mockResolvedValue({
        id_pedido: 7,
        id_factura: 20,
        numero_pedido: 106,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.cerrada,
        items: [],
      });

      const res = await service.cambiarEstado(7, { estado: 'Entregado' });
      expect(res.etapaOperativa).toBe('Entregado');
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

  describe('estadoServicio', () => {
    it('debe reportar activo cuando hay caja abierta y recepción activa', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: 'abierta' });

      const res = await service.obtenerEstadoServicio();
      expect(res.activo).toBe(true);
      expect(res.cajaAbierta).toBe(true);
      expect(res.recibiendoDomicilios).toBe(true);
    });

    it('debe reportar inactivo cuando no hay caja abierta', async () => {
      prisma.caja.findFirst.mockResolvedValue(null);

      const res = await service.obtenerEstadoServicio();
      expect(res.activo).toBe(false);
      expect(res.cajaAbierta).toBe(false);
      expect(res.motivo).toContain('sin turno de caja');
    });

    it('debe permitir al personal pausar la recepción de domicilios', async () => {
      prisma.caja.findFirst.mockResolvedValue({ id_caja: 1, estado: 'abierta' });

      await service.cambiarRecepcionDomicilios(false, 'Cocina saturada temporalmente');
      const res = await service.obtenerEstadoServicio();

      expect(res.activo).toBe(false);
      expect(res.recibiendoDomicilios).toBe(false);
      expect(res.motivo).toBe('Cocina saturada temporalmente');

      // Restaurar para otros tests
      await service.cambiarRecepcionDomicilios(true);
    });
  });

  describe('obtenerPorId (OWASP A01 - Prevención IDOR)', () => {
    it('debe arrojar NotFoundException si el pedido no existe o no es de tipo domicilio', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
    });

    it('debe arrojar ForbiddenException si un cliente intenta acceder a un pedido ajeno (IDOR)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 50,
        id_usuario: 1, // Pertenece a usuario 1
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });

      const usuarioAjeno = { id_usuario: 99, rol: RolUsuario.cliente };

      await expect(service.obtenerPorId(50, usuarioAjeno)).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir la consulta si el cliente es el dueño legítimo del pedido', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 50,
        id_usuario: 99,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });

      const usuarioDuenio = { id_usuario: 99, rol: RolUsuario.cliente };
      const resultado = await service.obtenerPorId(50, usuarioDuenio);

      expect(resultado.id_pedido).toBe(50);
      expect(resultado.etapaOperativa).toBe('En Preparación');
    });

    it('debe permitir la consulta a usuarios del personal (administrador/cajero)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 50,
        id_usuario: 99,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        items: [],
      });

      const usuarioStaff = { id_usuario: 2, rol: RolUsuario.cajero };
      const resultado = await service.obtenerPorId(50, usuarioStaff);

      expect(resultado.id_pedido).toBe(50);
    });
  });
});
