import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usuariosService: {
    obtenerPorId: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    usuariosService = {
      obtenerPorId: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'super-secret-key-at-least-32-chars-long';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: UsuariosService,
          useValue: usuariosService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('debe estar definido', () => {
    expect(strategy).toBeDefined();
  });

  it('debe validar y retornar el usuario activo correctamente', async () => {
    const mockUsuario = {
      id_usuario: 1,
      nombre: 'Carlos Mesero',
      usuario: 'cmesero',
      rol: RolUsuario.mesero,
      estado: EstadoUsuario.activo,
    };
    usuariosService.obtenerPorId.mockResolvedValue(mockUsuario);

    const payload = {
      sub: 1,
      usuario: 'cmesero',
      rol: RolUsuario.mesero,
      nombre: 'Carlos Mesero',
    };

    const resultado = await strategy.validate(payload);
    expect(resultado).toEqual(mockUsuario);
    expect(usuariosService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('debe lanzar UnauthorizedException si el usuario está inactivo', async () => {
    usuariosService.obtenerPorId.mockResolvedValue({
      id_usuario: 2,
      nombre: 'Usuario Inactivo',
      usuario: 'inactivo',
      rol: RolUsuario.mesero,
      estado: EstadoUsuario.inactivo,
    });

    const payload = {
      sub: 2,
      usuario: 'inactivo',
      rol: RolUsuario.mesero,
      nombre: 'Usuario Inactivo',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe lanzar UnauthorizedException si el usuario no existe', async () => {
    usuariosService.obtenerPorId.mockRejectedValue(new Error('No encontrado'));

    const payload = {
      sub: 999,
      usuario: 'inexistente',
      rol: RolUsuario.mesero,
      nombre: 'Inexistente',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
