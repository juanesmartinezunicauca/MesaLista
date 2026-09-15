import { Test, TestingModule } from '@nestjs/testing';
import { EstadoUsuario, RolUsuario } from './dto';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  let service: {
    crear: jest.Mock;
    obtenerTodos: jest.Mock;
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
    cambiarEstado: jest.Mock;
    eliminar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      obtenerTodos: jest.fn(),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarEstado: jest.fn(),
      eliminar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        {
          provide: UsuariosService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UsuariosController>(UsuariosController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('POST /usuarios debe delegar a service.crear', async () => {
    const dto = {
      nombre: 'Juan Mesero',
      usuario: 'jmesero',
      password: 'password123',
      rol: RolUsuario.mesero,
    };
    const mockRes = { id_usuario: 1, ...dto, estado: EstadoUsuario.activo };
    service.crear.mockResolvedValue(mockRes);

    const res = await controller.crear(dto);
    expect(service.crear).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockRes);
  });

  it('GET /usuarios debe delegar a service.obtenerTodos', async () => {
    const query = { rol: RolUsuario.cajero };
    service.obtenerTodos.mockResolvedValue([]);

    const res = await controller.obtenerTodos(query);
    expect(service.obtenerTodos).toHaveBeenCalledWith(query);
    expect(res).toEqual([]);
  });

  it('GET /usuarios/:id debe delegar a service.obtenerPorId', async () => {
    const mockRes = { id_usuario: 5, nombre: 'Ana' };
    service.obtenerPorId.mockResolvedValue(mockRes);

    const res = await controller.obtenerPorId(5);
    expect(service.obtenerPorId).toHaveBeenCalledWith(5);
    expect(res).toEqual(mockRes);
  });

  it('PATCH /usuarios/:id debe delegar a service.actualizar', async () => {
    const updateDto = { nombre: 'Ana Actualizada' };
    service.actualizar.mockResolvedValue({ id_usuario: 5, ...updateDto });

    const res = await controller.actualizar(5, updateDto);
    expect(service.actualizar).toHaveBeenCalledWith(5, updateDto);
    expect(res.nombre).toBe('Ana Actualizada');
  });

  it('PATCH /usuarios/:id/estado debe delegar a service.cambiarEstado', async () => {
    service.cambiarEstado.mockResolvedValue({
      id_usuario: 5,
      estado: EstadoUsuario.inactivo,
    });

    const res = await controller.cambiarEstado(5, {
      estado: EstadoUsuario.inactivo,
    });
    expect(service.cambiarEstado).toHaveBeenCalledWith(
      5,
      EstadoUsuario.inactivo,
    );
    expect(res.estado).toBe(EstadoUsuario.inactivo);
  });

  it('DELETE /usuarios/:id debe delegar a service.eliminar', async () => {
    service.eliminar.mockResolvedValue({
      mensaje: 'Usuario desactivado.',
      tipo: 'soft-delete',
    });

    const res = await controller.eliminar(5);
    expect(service.eliminar).toHaveBeenCalledWith(5);
    expect(res.tipo).toBe('soft-delete');
  });
});
