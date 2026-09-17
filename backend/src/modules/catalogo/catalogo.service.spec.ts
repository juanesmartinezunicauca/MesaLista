import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TipoAjuste } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoService } from './catalogo.service';

describe('CatalogoService', () => {
  let service: CatalogoService;
  let prisma: any;

  const mockProducto = {
    id_producto: 1,
    nombre: 'Hamburguesa Clásica',
    categoria: 'Hamburguesas',
    precio_venta: 18000,
    costo: 7500,
    ingredientes_removibles: 'Cebolla, Tomate, Salsa Especial',
    cantidad_inventario: 20,
    disponible: true,
  };

  beforeEach(async () => {
    prisma = {
      producto: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      itemPedido: {
        count: jest.fn(),
      },
      ajusteInventario: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      usuario: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogoService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CatalogoService>(CatalogoService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crear', () => {
    it('debe crear un producto correctamente con ingredientes en array', async () => {
      prisma.producto.findFirst.mockResolvedValue(null);
      prisma.producto.create.mockResolvedValue(mockProducto);

      const dto = {
        nombre: 'Hamburguesa Clásica',
        categoria: 'Hamburguesas',
        precio_venta: 18000,
        costo: 7500,
        ingredientes_removibles: ['Cebolla', 'Tomate', 'Salsa Especial'],
        cantidad_inventario: 20,
        disponible: true,
      };

      const resultado = await service.crear(dto);

      expect(prisma.producto.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: {
            equals: 'Hamburguesa Clásica',
            mode: 'insensitive',
          },
        },
      });
      expect(prisma.producto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: 'Hamburguesa Clásica',
          ingredientes_removibles: 'Cebolla, Tomate, Salsa Especial',
        }),
      });
      expect(resultado).toEqual(mockProducto);
    });

    it('debe lanzar ConflictException si el producto ya existe', async () => {
      prisma.producto.findFirst.mockResolvedValue(mockProducto);

      await expect(
        service.crear({
          nombre: 'Hamburguesa Clásica',
          categoria: 'Hamburguesas',
          precio_venta: 18000,
          costo: 7500,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('obtenerTodos', () => {
    it('debe retornar todos los productos', async () => {
      prisma.producto.findMany.mockResolvedValue([mockProducto]);

      const resultado = await service.obtenerTodos();

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      });
      expect(resultado).toEqual([mockProducto]);
    });

    it('debe aplicar filtros de categoría, disponible y búsqueda', async () => {
      prisma.producto.findMany.mockResolvedValue([mockProducto]);

      await service.obtenerTodos({
        categoria: 'Hamburguesas',
        disponible: true,
        busqueda: 'clásica',
      });

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: {
          categoria: { equals: 'Hamburguesas', mode: 'insensitive' },
          disponible: true,
          nombre: { contains: 'clásica', mode: 'insensitive' },
        },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      });
    });
  });

  describe('obtenerPorId', () => {
    it('debe retornar el producto si existe', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);

      const res = await service.obtenerPorId(1);
      expect(res).toEqual(mockProducto);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.producto.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizar', () => {
    it('debe actualizar un producto existente', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);
      prisma.producto.findFirst.mockResolvedValue(null);
      prisma.producto.update.mockResolvedValue({
        ...mockProducto,
        precio_venta: 20000,
      });

      const res = await service.actualizar(1, { precio_venta: 20000 });

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: expect.objectContaining({ precio_venta: 20000 }),
      });
      expect(res.precio_venta).toBe(20000);
    });

    it('debe lanzar ConflictException si el nombre colisiona con otro producto', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);
      prisma.producto.findFirst.mockResolvedValue({
        id_producto: 2,
        nombre: 'Hamburguesa Doble',
      });

      await expect(
        service.actualizar(1, { nombre: 'Hamburguesa Doble' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cambiarDisponibilidad', () => {
    it('debe alternar la disponibilidad del producto', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);
      prisma.producto.update.mockResolvedValue({
        ...mockProducto,
        disponible: false,
      });

      const res = await service.cambiarDisponibilidad(1, false);

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { disponible: false },
      });
      expect(res.disponible).toBe(false);
    });
  });

  describe('eliminar', () => {
    it('debe eliminar producto si no tiene historial comercial', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);
      prisma.itemPedido.count.mockResolvedValue(0);
      prisma.ajusteInventario.deleteMany.mockResolvedValue({ count: 0 });
      prisma.producto.delete.mockResolvedValue(mockProducto);

      const res = await service.eliminar(1);

      expect(prisma.producto.delete).toHaveBeenCalledWith({
        where: { id_producto: 1 },
      });
      expect(res.mensaje).toContain('eliminado correctamente');
    });

    it('debe rechazar eliminación si tiene registros en ítems de comanda', async () => {
      prisma.producto.findUnique.mockResolvedValue(mockProducto);
      prisma.itemPedido.count.mockResolvedValue(3);

      await expect(service.eliminar(1)).rejects.toThrow(ConflictException);
    });
  });

  describe('registrarAjusteInventario', () => {
    const mockUsuario = { id_usuario: 5, nombre: 'Admin' };

    it('debe registrar ajuste de tipo Entrada e incrementar stock', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        ...mockProducto,
        cantidad_inventario: 20,
      });
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);
      prisma.producto.update.mockResolvedValue({});
      prisma.ajusteInventario.create.mockResolvedValue({
        id_ajuste: 10,
        id_producto: 1,
        id_usuario: 5,
        tipo_ajuste: TipoAjuste.Entrada,
        cantidad: 15,
        motivo: 'Compra de materias primas',
      });

      const res = await service.registrarAjusteInventario(1, 5, {
        tipo_ajuste: TipoAjuste.Entrada,
        cantidad: 15,
        motivo: 'Compra de materias primas',
      });

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: 35 },
      });
      expect(res.nuevo_stock).toBe(35);
      expect(res.stock_anterior).toBe(20);
    });

    it('debe registrar ajuste de tipo Merma y decrementar stock', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        ...mockProducto,
        cantidad_inventario: 20,
      });
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);
      prisma.producto.update.mockResolvedValue({});
      prisma.ajusteInventario.create.mockResolvedValue({
        id_ajuste: 11,
        id_producto: 1,
        id_usuario: 5,
        tipo_ajuste: TipoAjuste.Merma,
        cantidad: 5,
        motivo: 'Carne vencida',
      });

      const res = await service.registrarAjusteInventario(1, 5, {
        tipo_ajuste: TipoAjuste.Merma,
        cantidad: 5,
        motivo: 'Carne vencida',
      });

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: 15 },
      });
      expect(res.nuevo_stock).toBe(15);
    });

    it('debe lanzar BadRequestException si la merma supera el stock actual', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        ...mockProducto,
        cantidad_inventario: 10,
      });
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);

      await expect(
        service.registrarAjusteInventario(1, 5, {
          tipo_ajuste: TipoAjuste.Merma,
          cantidad: 15,
          motivo: 'Exceso de merma',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe registrar ajuste de tipo Arqueo estableciendo el conteo exacto', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        ...mockProducto,
        cantidad_inventario: 10,
      });
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);
      prisma.producto.update.mockResolvedValue({});
      prisma.ajusteInventario.create.mockResolvedValue({
        id_ajuste: 12,
        id_producto: 1,
        id_usuario: 5,
        tipo_ajuste: TipoAjuste.Arqueo,
        cantidad: 18,
        motivo: 'Conteo físico de fin de mes',
      });

      const res = await service.registrarAjusteInventario(1, 5, {
        tipo_ajuste: TipoAjuste.Arqueo,
        cantidad: 18,
        motivo: 'Conteo físico de fin de mes',
      });

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id_producto: 1 },
        data: { cantidad_inventario: 18 },
      });
      expect(res.nuevo_stock).toBe(18);
    });
  });

  describe('obtenerCategorias', () => {
    it('debe retornar las categorías únicas ordenadas', async () => {
      prisma.producto.findMany.mockResolvedValue([
        { categoria: 'Bebidas' },
        { categoria: 'Entradas' },
        { categoria: 'Hamburguesas' },
      ]);

      const categorias = await service.obtenerCategorias();

      expect(categorias).toEqual(['Bebidas', 'Entradas', 'Hamburguesas']);
    });
  });
});
