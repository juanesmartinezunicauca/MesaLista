import { Test, TestingModule } from '@nestjs/testing';
import { TipoAjuste } from '@prisma/client';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

describe('CatalogoController', () => {
  let controller: CatalogoController;
  let service: {
    crear: jest.Mock;
    obtenerTodos: jest.Mock;
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
    cambiarDisponibilidad: jest.Mock;
    eliminar: jest.Mock;
    registrarAjusteInventario: jest.Mock;
    obtenerAjustesProducto: jest.Mock;
    obtenerCategorias: jest.Mock;
  };

  const mockProducto = {
    id_producto: 1,
    nombre: 'Hamburguesa Clásica',
    categoria: 'Hamburguesas',
    precio_venta: 18000,
    costo: 7500,
    cantidad_inventario: 10,
    disponible: true,
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      obtenerTodos: jest.fn(),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarDisponibilidad: jest.fn(),
      eliminar: jest.fn(),
      registrarAjusteInventario: jest.fn(),
      obtenerAjustesProducto: jest.fn(),
      obtenerCategorias: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogoController],
      providers: [
        {
          provide: CatalogoService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CatalogoController>(CatalogoController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('crearProducto debe delegar a service.crear', async () => {
    service.crear.mockResolvedValue(mockProducto);

    const dto = {
      nombre: 'Hamburguesa Clásica',
      categoria: 'Hamburguesas',
      precio_venta: 18000,
      costo: 7500,
    };

    const res = await controller.crearProducto(dto);

    expect(service.crear).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockProducto);
  });

  it('obtenerProductos debe delegar a service.obtenerTodos', async () => {
    service.obtenerTodos.mockResolvedValue([mockProducto]);

    const query = { categoria: 'Hamburguesas' };
    const res = await controller.obtenerProductos(query);

    expect(service.obtenerTodos).toHaveBeenCalledWith(query);
    expect(res).toEqual([mockProducto]);
  });

  it('obtenerCategorias debe delegar a service.obtenerCategorias', async () => {
    service.obtenerCategorias.mockResolvedValue(['Bebidas', 'Hamburguesas']);

    const res = await controller.obtenerCategorias();

    expect(service.obtenerCategorias).toHaveBeenCalled();
    expect(res).toEqual(['Bebidas', 'Hamburguesas']);
  });

  it('obtenerProductoPorId debe delegar a service.obtenerPorId', async () => {
    service.obtenerPorId.mockResolvedValue(mockProducto);

    const res = await controller.obtenerProductoPorId(1);

    expect(service.obtenerPorId).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockProducto);
  });

  it('actualizarProducto debe delegar a service.actualizar', async () => {
    service.actualizar.mockResolvedValue({ ...mockProducto, precio_venta: 20000 });

    const dto = { precio_venta: 20000 };
    const res = await controller.actualizarProducto(1, dto);

    expect(service.actualizar).toHaveBeenCalledWith(1, dto);
    expect(res.precio_venta).toBe(20000);
  });

  it('cambiarDisponibilidad debe delegar a service.cambiarDisponibilidad', async () => {
    service.cambiarDisponibilidad.mockResolvedValue({ ...mockProducto, disponible: false });

    const res = await controller.cambiarDisponibilidad(1, { disponible: false });

    expect(service.cambiarDisponibilidad).toHaveBeenCalledWith(1, false);
    expect(res.disponible).toBe(false);
  });

  it('eliminarProducto debe delegar a service.eliminar', async () => {
    service.eliminar.mockResolvedValue({ mensaje: 'Eliminado' });

    const res = await controller.eliminarProducto(1);

    expect(service.eliminar).toHaveBeenCalledWith(1);
    expect(res).toEqual({ mensaje: 'Eliminado' });
  });

  it('registrarAjuste debe delegar a service.registrarAjusteInventario pasando id_usuario', async () => {
    const ajusteMock = { ajuste: { id_ajuste: 1 }, stock_anterior: 10, nuevo_stock: 15 };
    service.registrarAjusteInventario.mockResolvedValue(ajusteMock);

    const dto = {
      tipo_ajuste: TipoAjuste.Entrada,
      cantidad: 5,
      motivo: 'Compra',
    };

    const res = await controller.registrarAjuste(1, dto, 7);

    expect(service.registrarAjusteInventario).toHaveBeenCalledWith(1, 7, dto);
    expect(res).toEqual(ajusteMock);
  });

  it('obtenerAjustes debe delegar a service.obtenerAjustesProducto', async () => {
    service.obtenerAjustesProducto.mockResolvedValue([]);

    const res = await controller.obtenerAjustes(1);

    expect(service.obtenerAjustesProducto).toHaveBeenCalledWith(1);
    expect(res).toEqual([]);
  });
});
