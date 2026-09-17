import { Test, TestingModule } from '@nestjs/testing';
import { EstadoPedido, TipoPedido } from '@prisma/client';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

describe('PedidosController', () => {
  let controller: PedidosController;
  let service: {
    crear: jest.Mock;
    obtenerTodos: jest.Mock;
    obtenerPorMesa: jest.Mock;
    obtenerPorId: jest.Mock;
    cambiarEstado: jest.Mock;
    cancelar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      obtenerTodos: jest.fn(),
      obtenerPorMesa: jest.fn(),
      obtenerPorId: jest.fn(),
      cambiarEstado: jest.fn(),
      cancelar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PedidosController],
      providers: [
        {
          provide: PedidosService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PedidosController>(PedidosController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('POST /pedidos debe delegar a service.crear con el id de usuario autenticado', async () => {
    const dto = {
      tipo: TipoPedido.salon,
      id_mesa: 1,
      items: [{ id_producto: 1, cantidad: 2 }],
    };
    const mockRes = { id_pedido: 1, ...dto, numero_pedido: 1 };
    service.crear.mockResolvedValue(mockRes);

    const res = await controller.crear(dto, 99);
    expect(service.crear).toHaveBeenCalledWith(dto, 99);
    expect(res).toEqual(mockRes);
  });

  it('GET /pedidos debe delegar a service.obtenerTodos', async () => {
    const query = { estado: EstadoPedido.enviada };
    const mockRes = [{ id_pedido: 1 }];
    service.obtenerTodos.mockResolvedValue(mockRes);

    const res = await controller.obtenerTodos(query);
    expect(service.obtenerTodos).toHaveBeenCalledWith(query);
    expect(res).toEqual(mockRes);
  });

  it('GET /pedidos/mesa/:id_mesa debe delegar a service.obtenerPorMesa', async () => {
    const mockRes = [{ id_pedido: 1, id_mesa: 5 }];
    service.obtenerPorMesa.mockResolvedValue(mockRes);

    const res = await controller.obtenerPorMesa(5);
    expect(service.obtenerPorMesa).toHaveBeenCalledWith(5);
    expect(res).toEqual(mockRes);
  });

  it('GET /pedidos/:id debe delegar a service.obtenerPorId', async () => {
    const mockRes = { id_pedido: 1 };
    service.obtenerPorId.mockResolvedValue(mockRes);

    const res = await controller.obtenerPorId(1);
    expect(service.obtenerPorId).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockRes);
  });

  it('PATCH /pedidos/:id/estado debe delegar a service.cambiarEstado', async () => {
    const dto = { estado: EstadoPedido.cancelada };
    const mockRes = { id_pedido: 1, estado: EstadoPedido.cancelada };
    service.cambiarEstado.mockResolvedValue(mockRes);

    const res = await controller.cambiarEstado(1, dto);
    expect(service.cambiarEstado).toHaveBeenCalledWith(1, dto);
    expect(res).toEqual(mockRes);
  });

  it('PATCH /pedidos/:id/cancelar debe delegar a service.cancelar', async () => {
    const mockRes = { id_pedido: 1, estado: EstadoPedido.cancelada };
    service.cancelar.mockResolvedValue(mockRes);

    const res = await controller.cancelar(1);
    expect(service.cancelar).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockRes);
  });
});
