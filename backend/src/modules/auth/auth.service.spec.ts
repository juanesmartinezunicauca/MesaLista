import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: {
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
    vincularOGuardarGoogleUsuario: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    usuariosService = {
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
      vincularOGuardarGoogleUsuario: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-client-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsuariosService,
          useValue: usuariosService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('obtenerPerfil', () => {
    it('debe delegar a usuariosService.obtenerPorId', async () => {
      const perfilMock = {
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      };
      usuariosService.obtenerPorId.mockResolvedValue(perfilMock);

      const resultado = await service.obtenerPerfil(1);

      expect(usuariosService.obtenerPorId).toHaveBeenCalledWith(1);
      expect(resultado).toEqual(perfilMock);
    });
  });

  describe('actualizarPerfil', () => {
    it('debe delegar a usuariosService.actualizar con los datos proporcionados', async () => {
      const dto = {
        nombre: 'Carlos Mesero Editado',
      };
      const perfilActualizadoMock = {
        id_usuario: 1,
        nombre: 'Carlos Mesero Editado',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      };

      usuariosService.actualizar.mockResolvedValue(perfilActualizadoMock);

      const resultado = await service.actualizarPerfil(1, dto);

      expect(usuariosService.actualizar).toHaveBeenCalledWith(1, {
        nombre: dto.nombre,
      });
      expect(resultado).toEqual(perfilActualizadoMock);
    });
  });

  describe('loginConGoogle', () => {
    it('debe arrojar BadRequestException si se envía un access_token que inicia con ya29.', async () => {
      await expect(
        service.loginConGoogle({ idToken: 'ya29.a0AfH6SM...' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe arrojar UnauthorizedException si el token no tiene el formato de 3 partes de un JWT', async () => {
      await expect(
        service.loginConGoogle({ idToken: 'token-invalido-sin-puntos' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe procesar id_token válido y autenticar al usuario', async () => {
      // Mock de verifyIdToken en el cliente de Google
      const mockPayload = {
        sub: 'google-sub-12345',
        email: 'usuario.google@unicauca.edu.co',
        name: 'Usuario Google',
        email_verified: true,
      };

      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => mockPayload,
        }),
      };

      usuariosService.vincularOGuardarGoogleUsuario!.mockResolvedValue({
        id_usuario: 10,
        nombre: 'Usuario Google',
        usuario: 'usuario.google',
        email: 'usuario.google@unicauca.edu.co',
        rol: RolUsuario.cliente,
        estado: EstadoUsuario.activo,
      });

      jwtService.sign.mockReturnValue('jwt-google-app-token');

      const res = await service.loginConGoogle({
        id_token: 'header.payload.signature',
      });

      expect(res.accessToken).toBe('jwt-google-app-token');
      expect(res.usuario.email).toBe('usuario.google@unicauca.edu.co');
      expect(res.usuario.rol).toBe(RolUsuario.cliente);
    });
  });
});
