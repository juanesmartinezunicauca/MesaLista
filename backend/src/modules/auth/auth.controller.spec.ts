import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    login: jest.Mock;
    obtenerPerfil: jest.Mock;
    actualizarPerfil: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      login: jest.fn(),
      obtenerPerfil: jest.fn(),
      actualizarPerfil: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('POST /auth/login debe delegar a authService.login', async () => {
    const loginDto = {
      usuario: 'cmesero',
      password: 'password123',
    };
    const mockRes = {
      accessToken: 'token-jwt-123',
      usuario: {
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      },
    };

    service.login.mockResolvedValue(mockRes);

    const res = await controller.login(loginDto);

    expect(service.login).toHaveBeenCalledWith(loginDto);
    expect(res).toEqual(mockRes);
  });

  it('GET /auth/perfil debe delegar a authService.obtenerPerfil con el id del usuario', async () => {
    const mockPerfil = {
      id_usuario: 1,
      nombre: 'Carlos Mesero',
      usuario: 'cmesero',
      rol: RolUsuario.mesero,
      estado: EstadoUsuario.activo,
    };

    service.obtenerPerfil.mockResolvedValue(mockPerfil);

    const res = await controller.perfil(1);

    expect(service.obtenerPerfil).toHaveBeenCalledWith(1);
    expect(res).toEqual(mockPerfil);
  });

  it('PATCH /auth/perfil debe delegar a authService.actualizarPerfil con el id del usuario', async () => {
    const updateDto = {
      nombre: 'Carlos Mesero Actualizado',
      password: 'newpassword123',
    };
    const mockPerfilActualizado = {
      id_usuario: 1,
      nombre: 'Carlos Mesero Actualizado',
      usuario: 'cmesero',
      rol: RolUsuario.mesero,
      estado: EstadoUsuario.activo,
    };

    service.actualizarPerfil.mockResolvedValue(mockPerfilActualizado);

    const res = await controller.actualizarPerfil(1, updateDto);

    expect(service.actualizarPerfil).toHaveBeenCalledWith(1, updateDto);
    expect(res).toEqual(mockPerfilActualizado);
  });
});
