import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoUsuario, RolUsuario } from './dto';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('crear', () => {
    it('debe crear un usuario exitosamente con contraseña hasheada en Argon2id', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const mockCreado = {
        id_usuario: 1,
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      };

      prisma.usuario.create.mockResolvedValue(mockCreado);

      const resultado = await service.crear({
        nombre: 'Carlos Mesero',
        usuario: 'cmesero',
        password: 'passwordSegura123',
        rol: RolUsuario.mesero,
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { usuario: 'cmesero' },
      });
      expect(prisma.usuario.create).toHaveBeenCalled();
      const createArgs = prisma.usuario.create.mock.calls[0][0];
      expect(createArgs.data.usuario).toBe('cmesero');
      expect(createArgs.data.passwordHash).toBeDefined();
      expect(createArgs.data.passwordHash).not.toBe('passwordSegura123');

      // Verificar que el hash generado es efectivamente válido con argon2
      const esValido = await argon2.verify(
        createArgs.data.passwordHash,
        'passwordSegura123',
      );
      expect(esValido).toBe(true);

      expect(resultado).toEqual(mockCreado);
    });

    it('debe lanzar ConflictException si el nombre de usuario ya existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 2,
        usuario: 'yaexiste',
      });

      await expect(
        service.crear({
          nombre: 'Juan Admin',
          usuario: 'yaexiste',
          password: 'password123',
          rol: RolUsuario.administrador,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('obtenerPorId', () => {
    it('debe retornar el usuario si existe', async () => {
      const mockUsuario = {
        id_usuario: 1,
        nombre: 'Carlos',
        usuario: 'carlos',
        rol: RolUsuario.cajero,
        estado: EstadoUsuario.activo,
      };
      prisma.usuario.findUnique.mockResolvedValue(mockUsuario);

      const res = await service.obtenerPorId(1);
      expect(res).toEqual(mockUsuario);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizar', () => {
    it('debe lanzar ConflictException si el nuevo usuario ya pertenece a otro id', async () => {
      // Existente actual
      prisma.usuario.findUnique
        .mockResolvedValueOnce({ id_usuario: 1, usuario: 'actual' }) // en obtenerPorId
        .mockResolvedValueOnce({ id_usuario: 2, usuario: 'en_uso' }); // en colision check

      await expect(
        service.actualizar(1, { usuario: 'en_uso' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe actualizar y re-hashear la contraseña si se provee una nueva', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        usuario: 'carlos',
      });
      prisma.usuario.update.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Carlos Modificado',
        usuario: 'carlos',
        rol: RolUsuario.cajero,
        estado: EstadoUsuario.activo,
      });

      const res = await service.actualizar(1, {
        nombre: 'Carlos Modificado',
        password: 'nuevaPassword456',
      });

      expect(prisma.usuario.update).toHaveBeenCalled();
      const updateArgs = prisma.usuario.update.mock.calls[0][0];
      const esValido = await argon2.verify(
        updateArgs.data.passwordHash,
        'nuevaPassword456',
      );
      expect(esValido).toBe(true);
      expect(res.nombre).toBe('Carlos Modificado');
    });
  });

  describe('eliminar', () => {
    it('debe realizar borrado lógico (inactivo) si tiene historial operativo', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce({ id_usuario: 1, usuario: 'carlos' }) // obtenerPorId
        .mockResolvedValueOnce({
          id_usuario: 1,
          _count: {
            pedidos: 5,
            facturas: 0,
            cajasApertura: 0,
            cajasCierre: 0,
            gastos: 0,
            ajustesInventario: 0,
          },
        }); // findUnique include _count

      prisma.usuario.update.mockResolvedValue({
        id_usuario: 1,
        estado: EstadoUsuario.inactivo,
      });

      const res = await service.eliminar(1);
      expect(res.tipo).toBe('soft-delete');
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
        data: { estado: EstadoUsuario.inactivo },
      });
      expect(prisma.usuario.delete).not.toHaveBeenCalled();
    });

    it('debe realizar borrado físico si no tiene ningún registro asociado', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce({ id_usuario: 2, usuario: 'nuevo_sin_historial' })
        .mockResolvedValueOnce({
          id_usuario: 2,
          _count: {
            pedidos: 0,
            facturas: 0,
            cajasApertura: 0,
            cajasCierre: 0,
            gastos: 0,
            ajustesInventario: 0,
          },
        });

      prisma.usuario.delete.mockResolvedValue({ id_usuario: 2 });

      const res = await service.eliminar(2);
      expect(res.tipo).toBe('hard-delete');
      expect(prisma.usuario.delete).toHaveBeenCalledWith({
        where: { id_usuario: 2 },
      });
    });
  });
});
