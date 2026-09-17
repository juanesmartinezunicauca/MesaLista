import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import * as argon2 from 'argon2';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: {
    obtenerPorUsernameParaAuth: jest.Mock;
    obtenerPorId: jest.Mock;
    actualizar: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  const passwordPlano = 'passwordSegura123';
  let passwordHashReal: string;

  beforeAll(async () => {
    passwordHashReal = await argon2.hash(passwordPlano, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  });

  beforeEach(async () => {
    usuariosService = {
      obtenerPorUsernameParaAuth: jest.fn(),
      obtenerPorId: jest.fn(),
      actualizar: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('validarUsuario', () => {
    it('debe validar credenciales correctamente y retornar usuario sin password', async () => {
      usuariosService.obtenerPorUsernameParaAuth.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        passwordHash: passwordHashReal,
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      });

      const usuario = await service.validarUsuario('cmesero', passwordPlano);

      expect(usuario).toEqual({
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      });
      expect((usuario as any).passwordHash).toBeUndefined();
    });

    it('debe lanzar UnauthorizedException si el usuario no existe', async () => {
      usuariosService.obtenerPorUsernameParaAuth.mockResolvedValue(null);

      await expect(
        service.validarUsuario('noexiste', passwordPlano),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si el usuario está inactivo', async () => {
      usuariosService.obtenerPorUsernameParaAuth.mockResolvedValue({
        id_usuario: 2,
        nombre: 'Usuario Inactivo',
        usuario: 'inactivo',
        passwordHash: passwordHashReal,
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.inactivo,
      });

      await expect(
        service.validarUsuario('inactivo', passwordPlano),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      usuariosService.obtenerPorUsernameParaAuth.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        passwordHash: passwordHashReal,
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      });

      await expect(
        service.validarUsuario('cmesero', 'passwordEquivocada'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('debe autenticar al usuario y generar un token JWT válido', async () => {
      usuariosService.obtenerPorUsernameParaAuth.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        passwordHash: passwordHashReal,
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      });

      jwtService.sign.mockReturnValue('jwt-token-simulado-xyz');

      const respuesta = await service.login({
        usuario: 'cmesero',
        password: passwordPlano,
      });

      expect(respuesta.accessToken).toBe('jwt-token-simulado-xyz');
      expect(respuesta.usuario).toEqual({
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        nombre: 'Carlos Mesero',
      });
    });
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
        password: 'nuevapassword123',
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
        password: dto.password,
      });
      expect(resultado).toEqual(perfilActualizadoMock);
    });
  });
});
