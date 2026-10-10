import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUsuarioDto,
  EstadoUsuario,
  QueryUsuarioDto,
  RolUsuario,
  UpdateUsuarioDto,
} from './dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) { }

  // Proyección que excluye deliberadamente el hash de contraseña de las respuestas
  private readonly usuarioSelectSinPassword = {
    id_usuario: true,
    nombre: true,
    usuario: true,
    email: true,
    rol: true,
    estado: true,
  } as const;

  /**
   * Registra un nuevo usuario con contraseña hasheada mediante Argon2id (OWASP).
   */
  async crear(createUsuarioDto: CreateUsuarioDto) {
    const emailNormalizado = createUsuarioDto.email.trim().toLowerCase();

    // Validar si el email ya existe
    const emailExistente = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });

    if (emailExistente) {
      throw new ConflictException(
        `El correo electrónico '${emailNormalizado}' ya está registrado.`,
      );
    }

    // Resolver username: si no viene especificado, se deriva del email
    let finalUsername = createUsuarioDto.usuario?.trim();
    if (!finalUsername) {
      const base = emailNormalizado.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'usuario';
      finalUsername = base;
      let counter = 1;
      while (await this.prisma.usuario.findUnique({ where: { usuario: finalUsername } })) {
        finalUsername = `${base.slice(0, 35)}_${counter++}`;
      }
    } else {
      const usuarioExistente = await this.prisma.usuario.findUnique({
        where: { usuario: finalUsername },
      });

      if (usuarioExistente) {
        throw new ConflictException(
          `El nombre de usuario '${finalUsername}' ya está en uso.`,
        );
      }
    }

    // Hashear contraseña solo si se especificó explícitamente (cuenta tradicional)
    // De lo contrario, queda tercerizado exclusivamente a Google OAuth (passwordHash: null)
    let passwordHash: string | null = null;
    if (createUsuarioDto.password && createUsuarioDto.password.trim()) {
      passwordHash = await argon2.hash(createUsuarioDto.password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iteraciones
        parallelism: 4,
      });
    }

    return this.prisma.usuario.create({
      data: {
        nombre: createUsuarioDto.nombre.trim(),
        usuario: finalUsername,
        email: emailNormalizado,
        passwordHash,
        rol: createUsuarioDto.rol,
        estado: createUsuarioDto.estado ?? EstadoUsuario.activo,
      },
      select: this.usuarioSelectSinPassword,
    });
  }

  /**
   * Consulta usuarios con filtros opcionales de rol, estado y búsqueda de texto.
   */
  async obtenerTodos(filtros?: QueryUsuarioDto) {
    const where: any = {};

    if (filtros?.rol) {
      where.rol = filtros.rol;
    } else {
      // Por regla de negocio, el módulo de Personal solo lista colaboradores operativos
      where.rol = { not: RolUsuario.cliente };
    }

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    if (filtros?.buscar) {
      const termino = filtros.buscar.trim();
      where.OR = [
        { nombre: { contains: termino, mode: 'insensitive' } },
        { usuario: { contains: termino, mode: 'insensitive' } },
      ];
    }

    return this.prisma.usuario.findMany({
      where,
      select: this.usuarioSelectSinPassword,
      orderBy: { id_usuario: 'asc' },
    });
  }

  /**
   * Obtiene un usuario específico por su ID.
   */
  async obtenerPorId(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
      select: this.usuarioSelectSinPassword,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID #${id} no encontrado.`);
    }

    return usuario;
  }

  /**
   * Método interno para autenticación (AuthModule).
   * Incluye passwordHash para verificación con argon2.verify.
   * Permite autenticar tanto por nombre de usuario como por correo electrónico.
   */
  async obtenerPorUsernameParaAuth(usuarioOEmail: string) {
    return this.prisma.usuario.findFirst({
      where: {
        OR: [
          { usuario: usuarioOEmail },
          { email: usuarioOEmail },
        ],
      },
    });
  }

  /**
   * Vincula una cuenta de Google OAuth existente por googleId o email,
   * o registra un nuevo usuario con rol 'mesero' activo si no existe previamente.
   */
  async vincularOGuardarGoogleUsuario(perfil: {
    googleId: string;
    email: string;
    nombre: string;
  }) {
    // 1. Buscar si ya existe por googleId
    let usuario = await this.prisma.usuario.findUnique({
      where: { googleId: perfil.googleId },
    });

    if (usuario) {
      return usuario;
    }

    // 2. Si no existe por googleId, buscar si ya existe un usuario con ese correo electrónico
    usuario = await this.prisma.usuario.findUnique({
      where: { email: perfil.email },
    });

    if (usuario) {
      return this.prisma.usuario.update({
        where: { id_usuario: usuario.id_usuario },
        data: { googleId: perfil.googleId },
      });
    }

    // 3. Crear usuario nuevo con rol 'cliente' y estado activo si no estaba registrado previamente
    const baseUsername =
      perfil.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'cliente';
    let uniqueUsername = baseUsername;
    let counter = 1;

    while (
      await this.prisma.usuario.findUnique({
        where: { usuario: uniqueUsername },
      })
    ) {
      uniqueUsername = `${baseUsername.slice(0, 35)}_${counter++}`;
    }

    return this.prisma.usuario.create({
      data: {
        nombre: perfil.nombre.slice(0, 100),
        usuario: uniqueUsername,
        email: perfil.email,
        googleId: perfil.googleId,
        rol: RolUsuario.cliente,
        estado: EstadoUsuario.activo,
      },
    });
  }


  /**
   * Actualiza datos de un usuario. Si se incluye contraseña, se re-hashea con Argon2id.
   */
  async actualizar(id: number, updateDto: UpdateUsuarioDto) {
    await this.obtenerPorId(id);

    if (updateDto.usuario) {
      const colision = await this.prisma.usuario.findUnique({
        where: { usuario: updateDto.usuario },
      });

      if (colision && colision.id_usuario !== id) {
        throw new ConflictException(
          `El nombre de usuario '${updateDto.usuario}' ya está en uso.`,
        );
      }
    }

    if (updateDto.email) {
      const colisionEmail = await this.prisma.usuario.findUnique({
        where: { email: updateDto.email },
      });

      if (colisionEmail && colisionEmail.id_usuario !== id) {
        throw new ConflictException(
          `El correo '${updateDto.email}' ya está en uso.`,
        );
      }
    }

    let passwordHash: string | undefined;
    if (updateDto.password) {
      passwordHash = await argon2.hash(updateDto.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    }

    return this.prisma.usuario.update({
      where: { id_usuario: id },
      data: {
        ...(updateDto.nombre && { nombre: updateDto.nombre }),
        ...(updateDto.usuario && { usuario: updateDto.usuario }),
        ...(updateDto.email !== undefined && { email: updateDto.email }),
        ...(updateDto.rol && { rol: updateDto.rol }),
        ...(updateDto.estado && { estado: updateDto.estado }),
        ...(passwordHash && { passwordHash }),
      },
      select: this.usuarioSelectSinPassword,
    });
  }

  /**
   * Cambia el estado de un usuario (activo / inactivo).
   */
  async cambiarEstado(id: number, estado: EstadoUsuario) {
    await this.obtenerPorId(id);

    return this.prisma.usuario.update({
      where: { id_usuario: id },
      data: { estado },
      select: this.usuarioSelectSinPassword,
    });
  }

  /**
   * Eliminación segura:
   * - Si el usuario tiene registros operativos históricos (pedidos, cajas, facturas, etc.),
   *   se desactiva (borrado lógico) para proteger la trazabilidad y la integridad referencial.
   * - Si no tiene historial, se elimina de forma física de la base de datos.
   */
  async eliminar(id: number) {
    await this.obtenerPorId(id);

    const usuarioConRelaciones = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        _count: {
          select: {
            pedidos: true,
            facturas: true,
            cajasApertura: true,
            cajasCierre: true,
            gastos: true,
            ajustesInventario: true,
          },
        },
      },
    });

    const counts = usuarioConRelaciones?._count;
    const tieneHistorial =
      counts &&
      (counts.pedidos > 0 ||
        counts.facturas > 0 ||
        counts.cajasApertura > 0 ||
        counts.cajasCierre > 0 ||
        counts.gastos > 0 ||
        counts.ajustesInventario > 0);

    if (tieneHistorial) {
      await this.prisma.usuario.update({
        where: { id_usuario: id },
        data: { estado: EstadoUsuario.inactivo },
      });

      return {
        mensaje: `El usuario #${id} tiene historial contable y operativo en el restaurante; ha sido desactivado (borrado lógico).`,
        tipo: 'soft-delete',
        id_usuario: id,
        estado: EstadoUsuario.inactivo,
      };
    }

    await this.prisma.usuario.delete({
      where: { id_usuario: id },
    });

    return {
      mensaje: `El usuario #${id} ha sido eliminado definitivamente del sistema.`,
      tipo: 'hard-delete',
      id_usuario: id,
    };
  }
}
