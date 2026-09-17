import { Test, TestingModule } from '@nestjs/testing';
import { EstadoMesa } from '@prisma/client';
import { MesasController } from './mesas.controller';
import { MesasService } from './mesas.service';

describe('MesasController', () => {
  let controller: MesasController;
  let service: {
    crear: jest.Mock;
    obtenerTodas: jest.Mock;
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
    cambiarEstado: jest.Mock;
    eliminar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      obtenerTodas: jest.fn(),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarEstado: jest.fn(),
      eliminar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MesasController],
      providers: [
        {
          provide: MesasService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<MesasController>(MesasController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('POST /mesas debe delegar a service.crear', async () => {
    const dto = { numero: 1, estado: EstadoMesa.libre };
    const mockRes = { id_mesa: 1, ...dto };
    service.crear.mockResolvedValue(mockRes);

    const res = await controller.crear(dto);
    expect(service.crear).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockRes);
  });

  it('GET /mesas debe delegar a service.obtenerTodas', async () => {
    const query = { estado: EstadoMesa.libre };
    const mockRes = [{ id_mesa: 1, numero: 1, estado: EstadoMesa.libre }];
    service.obtenerTodas.mockResolvedValue(mockRes);

    const res = await controller.obtenerTodas(query);
    expect(service.obtenerTodas).toHaveBeenCalledWith(query);
    expect(res).toEqual(mockRes);
  });

  it('GET /mesas/:id debe delegar a service.obtenerPorId', async () => {
    const mockRes = { id_mesa: 1, numero: 1, estado: EstadoMesa.libre };
    service.obtenerPorId.mockResolvedValue(mockRes);

    const res = await controller.obtenerPorId(1);
    expect(service.obtenerPorId).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockRes);
  });

  it('PATCH /mesas/:id/estado debe delegar a service.cambiarEstado', async () => {
    const dto = { estado: EstadoMesa.ocupada };
    const mockRes = { id_mesa: 1, numero: 1, estado: EstadoMesa.ocupada };
    service.cambiarEstado.mockResolvedValue(mockRes);

    const res = await controller.cambiarEstado(1, dto);
    expect(service.cambiarEstado).toHaveBeenCalledWith(1, dto);
    expect(res).toEqual(mockRes);
  });

  it('PATCH /mesas/:id debe delegar a service.actualizar', async () => {
    const dto = { numero: 15 };
    const mockRes = { id_mesa: 1, numero: 15, estado: EstadoMesa.libre };
    service.actualizar.mockResolvedValue(mockRes);

    const res = await controller.actualizar(1, dto);
    expect(service.actualizar).toHaveBeenCalledWith(1, dto);
    expect(res).toEqual(mockRes);
  });

  it('DELETE /mesas/:id debe delegar a service.eliminar', async () => {
    const mockRes = { mensaje: 'La mesa #1 ha sido eliminada exitosamente.', id_mesa: 1 };
    service.eliminar.mockResolvedValue(mockRes);

    const res = await controller.eliminar(1);
    expect(service.eliminar).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockRes);
  });
});
