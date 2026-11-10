import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoUsuario, RolUsuario } from './dto';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let module: TestingModule;
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
    },
  };
  const mockMailService = {
    enviarCodigoInvitacion: jest.fn(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    prisma.usuario.findUnique.mockReset();
    prisma.usuario.findFirst.mockReset().mockResolvedValue(null);
    prisma.usuario.findMany.mockReset();
    prisma.usuario.create.mockReset();
    prisma.usuario.update.mockReset();
    prisma.usuario.updateMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.usuario.delete.mockReset();
    mockMailService.enviarCodigoInvitacion.mockReset();

    prisma.usuario.findUnique.mockResolvedValue(null);
    mockMailService.enviarCodigoInvitacion.mockResolvedValue({
      enviado: true,
      transport: 'simulado',
      destinatario: 'test@correo.com',
    });
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
        email: 'cmesero@unicauca.edu.co',
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

      expect(resultado).toMatchObject(mockCreado);
    });

    it('debe crear un empleado pre-autorizado para Google OAuth sin contraseña (passwordHash en null)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const mockCreado = {
        id_usuario: 2,
        nombre: 'Ana Cajera',
        usuario: 'anacajera',
        email: null,
        rol: RolUsuario.cajero,
        estado: EstadoUsuario.activo,
      };

      prisma.usuario.create.mockResolvedValue(mockCreado);

      const resultado = await service.crear({
        nombre: 'Ana Cajera',
        email: 'ana@unicauca.edu.co',
        rol: RolUsuario.cajero,
      });

      expect(prisma.usuario.create).toHaveBeenCalled();
      const createArgs = prisma.usuario.create.mock.calls[0][0];
      expect(createArgs.data.email).toBeNull();
      expect(createArgs.data.passwordHash).toBeNull();
      expect(resultado).toMatchObject(mockCreado);
    });

    it('debe enviar el código de registro al correo efímero sin guardarlo en la base de datos (email en null)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const mockCreado = {
        id_usuario: 3,
        nombre: 'Mateo Mesero',
        usuario: 'mateomesero',
        email: null,
        codigoInvitacion: 'INV-789123',
        rol: RolUsuario.mesero,
        estado: EstadoUsuario.activo,
      };

      prisma.usuario.create.mockResolvedValue(mockCreado);

      const resultado = await service.crear({
        nombre: 'Mateo Mesero',
        correoEnvioCodigo: 'mateo_personal@gmail.com',
        rol: RolUsuario.mesero,
      });

      // El correo para despacho se envía vía MailService
      expect(mockMailService.enviarCodigoInvitacion).toHaveBeenCalledWith(
        'mateo_personal@gmail.com',
        expect.objectContaining({
          nombre: 'Mateo Mesero',
          codigo: expect.stringMatching(/^INV-[A-Z0-9]{6,8}$/),
        }),
      );

      // Verificación estricta: ¡El correo de envío NO se guarda en la base de datos!
      const createArgs = prisma.usuario.create.mock.calls[0][0];
      expect(createArgs.data.email).toBeNull();
      expect(resultado.guardadoEnBaseDeDatos).toBe(false);
      expect(resultado.correoEnviado).toBe(true);
    });

    it('debe lanzar ConflictException si el correo electrónico ya existe (cliente)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 2,
        email: 'yaexiste@unicauca.edu.co',
      });

      await expect(
        service.crear({
          nombre: 'Juan Cliente',
          email: 'yaexiste@unicauca.edu.co',
          rol: RolUsuario.cliente,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar ConflictException si el nombre de usuario ya existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 2,
        usuario: 'juanadmin',
      });

      await expect(
        service.crear({
          nombre: 'Juan Admin',
          usuario: 'juanadmin',
          rol: RolUsuario.administrador,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('enviarCodigoPorCorreo', () => {
    it('debe despachar el código por correo sin almacenar el destinatario en BD', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 10,
        nombre: 'Lucía Cocina',
        rol: RolUsuario.cocina,
        codigoInvitacion: 'INV-445566',
      });

      const res = await service.enviarCodigoPorCorreo(10, 'lucia_destino@yahoo.com');

      expect(mockMailService.enviarCodigoInvitacion).toHaveBeenCalledWith(
        'lucia_destino@yahoo.com',
        {
          nombre: 'Lucía Cocina',
          rol: RolUsuario.cocina,
          codigo: 'INV-445566',
        },
      );
      expect(res.success).toBe(true);
      expect(res.guardadoEnBaseDeDatos).toBe(false);
      expect(res.destinatario).toBe('lucia_destino@yahoo.com');
      // No debe llamar a update en usuario para guardar el correo
      expect(prisma.usuario.update).not.toHaveBeenCalled();
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
      prisma.usuario.findUnique
        .mockResolvedValueOnce({ id_usuario: 1, usuario: 'actual' })
        .mockResolvedValueOnce({ id_usuario: 2, usuario: 'en_uso' });

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
        .mockResolvedValueOnce({ id_usuario: 1, usuario: 'carlos' })
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
        });

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
