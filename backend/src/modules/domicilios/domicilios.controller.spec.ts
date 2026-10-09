import { Test, TestingModule } from '@nestjs/testing';
import { DomiciliosController } from './domicilios.controller';
import { DomiciliosService } from './domicilios.service';

describe('DomiciliosController', () => {
  let controller: DomiciliosController;
  let service: {
    crear: jest.Mock;
    buscarClientes: jest.Mock;
    obtenerTodos: jest.Mock;
    obtenerPorId: jest.Mock;
    cambiarEstado: jest.Mock;
    cancelar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      buscarClientes: jest.fn(),
      obtenerTodos: jest.fn(),
      obtenerPorId: jest.fn(),
      cambiarEstado: jest.fn(),
      cancelar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomiciliosController],
      providers: [
        {
          provide: DomiciliosService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DomiciliosController>(DomiciliosController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe delegar la creación de un domicilio al servicio', async () => {
    const dto = {
      cliente: { nombre: 'Juan', telefono: '3001234567', direccion: 'Calle 1' },
      items: [{ id_producto: 1, cantidad: 1 }],
    };
    service.crear.mockResolvedValue({ id_pedido: 10 });

    const result = await controller.crear(dto, 2);

    expect(service.crear).toHaveBeenCalledWith(dto, 2);
    expect(result).toEqual({ id_pedido: 10 });
  });

  it('debe delegar la búsqueda de clientes al servicio', async () => {
    service.buscarClientes.mockResolvedValue([{ nombre: 'Juan' }]);

    const result = await controller.buscarClientes('300');

    expect(service.buscarClientes).toHaveBeenCalledWith('300');
    expect(result).toEqual([{ nombre: 'Juan' }]);
  });

  it('debe delegar el listado de domicilios al servicio', async () => {
    service.obtenerTodos.mockResolvedValue([]);

    const result = await controller.obtenerTodos('En Preparación', '2026-09-28', 'Juan');

    expect(service.obtenerTodos).toHaveBeenCalledWith({
      estado: 'En Preparación',
      fecha: '2026-09-28',
      buscar: 'Juan',
    });
    expect(result).toEqual([]);
  });

  it('debe delegar la obtención por ID al servicio', async () => {
    service.obtenerPorId.mockResolvedValue({ id_pedido: 5 });

    const result = await controller.obtenerPorId(5);

    expect(service.obtenerPorId).toHaveBeenCalledWith(5, undefined);
    expect(result).toEqual({ id_pedido: 5 });
  });

  it('debe delegar el cambio de estado al servicio', async () => {
    const dto = { estado: 'En Reparto' };
    service.cambiarEstado.mockResolvedValue({ id_pedido: 5, etapaOperativa: 'En Reparto' });

    const result = await controller.cambiarEstado(5, dto, 2);

    expect(service.cambiarEstado).toHaveBeenCalledWith(5, dto, 2);
    expect(result).toEqual({ id_pedido: 5, etapaOperativa: 'En Reparto' });
  });

  it('debe delegar la cancelación al servicio', async () => {
    service.cancelar.mockResolvedValue({ id_pedido: 5, etapaOperativa: 'Cancelado' });

    const result = await controller.cancelar(5, 'Dirección no existe');

    expect(service.cancelar).toHaveBeenCalledWith(5, 'Dirección no existe');
    expect(result).toEqual({ id_pedido: 5, etapaOperativa: 'Cancelado' });
  });
});
