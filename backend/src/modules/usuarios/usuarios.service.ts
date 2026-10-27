import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
    codigoInvitacion: true,
  } as const;

  /**
   * Registra un nuevo usuario con contraseña hasheada mediante Argon2id (OWASP).
   */
  async crear(createUsuarioDto: CreateUsuarioDto) {
    const emailNormalizado = createUsuarioDto.email ? createUsuarioDto.email.trim().toLowerCase() : null;

    // Validar si el email ya existe (si fue provisto)
    if (emailNormalizado) {
      const emailExistente = await this.prisma.usuario.findUnique({
        where: { email: emailNormalizado },
      });

      if (emailExistente) {
        throw new ConflictException(
          `El correo electrónico '${emailNormalizado}' ya está registrado.`,
        );
      }
    }

    // Resolver username: si no viene especificado, se deriva del email o del nombre
    let finalUsername = createUsuarioDto.usuario?.trim();
    if (!finalUsername) {
      const base = emailNormalizado
        ? emailNormalizado.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40)
        : createUsuarioDto.nombre.trim().toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'colaborador';
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

    // Generar código de invitación seguro para roles operativos
    let codigoInvitacion: string | null = null;
    if (createUsuarioDto.rol !== RolUsuario.cliente) {
      const randDigits = Math.floor(100000 + Math.random() * 900000);
      codigoInvitacion = `INV-${randDigits}`;
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
        codigoInvitacion,
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
   * Vincula una cuenta de Google OAuth existente por código de invitación, googleId o email/username,
   * garantizando que los colaboradores operativos registrados mantengan su rol correspondiente.
   * Si no existe registro previo, registra un nuevo usuario con rol 'cliente'.
   */
  async vincularOGuardarGoogleUsuario(perfil: {
    googleId: string;
    email: string;
    nombre: string;
    codigoInvitacion?: string;
  }) {
    const emailNorm = perfil.email.trim().toLowerCase();

    // 1. Si se suministró un código de invitación, validar y vincular prioritariamente al colaborador
    if (perfil.codigoInvitacion && perfil.codigoInvitacion.trim()) {
      const codigoNormalizado = perfil.codigoInvitacion.trim().toUpperCase();
      const usuarioInvitado = await this.prisma.usuario.findFirst({
        where: { codigoInvitacion: codigoNormalizado },
      });

      if (!usuarioInvitado) {
        throw new UnauthorizedException(
          'El código de invitación ingresado es inválido o ya ha sido utilizado.',
        );
      }

      // Liberar googleId de cualquier cuenta previa para evitar conflicto de unicidad en PostgreSQL
      await this.prisma.usuario.updateMany({
        where: {
          googleId: perfil.googleId,
          id_usuario: { not: usuarioInvitado.id_usuario },
        },
        data: { googleId: null },
      });

      // Vincular el googleId y quemar el código de invitación de un solo uso
      return this.prisma.usuario.update({
        where: { id_usuario: usuarioInvitado.id_usuario },
        data: {
          googleId: perfil.googleId,
          codigoInvitacion: null, // Token de un solo uso consumido
          ...(usuarioInvitado.email ? {} : { email: emailNorm }),
        },
      });
    }

    // 2. PRIORIDAD MÁXIMA PARA COLABORADORES REGISTRADOS:
    // Buscar si existe un empleado operativo (administrador, cajero, mesero, cocina) por correo,
    // nombre de usuario, prefijo de correo, nombre completo o googleId.
    const usernamePrefix = emailNorm.split('@')[0];
    const nombreGoogle = perfil.nombre.trim();

    const empleadoOperativo = await this.prisma.usuario.findFirst({
      where: {
        rol: { not: RolUsuario.cliente },
        OR: [
          { email: { equals: emailNorm, mode: 'insensitive' } },
          { usuario: { equals: emailNorm, mode: 'insensitive' } },
          { usuario: { equals: usernamePrefix, mode: 'insensitive' } },
          { nombre: { equals: nombreGoogle, mode: 'insensitive' } },
          { googleId: perfil.googleId },
        ],
      },
    });

    if (empleadoOperativo) {
      // Si el googleId estaba asociado a una cuenta temporal o de cliente, liberarlo
      await this.prisma.usuario.updateMany({
        where: {
          googleId: perfil.googleId,
          id_usuario: { not: empleadoOperativo.id_usuario },
        },
        data: { googleId: null },
      });

      return this.prisma.usuario.update({
        where: { id_usuario: empleadoOperativo.id_usuario },
        data: {
          googleId: perfil.googleId,
          ...(empleadoOperativo.email ? {} : { email: emailNorm }),
        },
      });
    }

    // 3. Buscar si ya existe un usuario registrado (cliente recurrente) por googleId, email o usuario
    const usuarioExistente = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { googleId: perfil.googleId },
          { email: { equals: emailNorm, mode: 'insensitive' } },
          { usuario: { equals: emailNorm, mode: 'insensitive' } },
        ],
      },
    });

    if (usuarioExistente) {
      if (usuarioExistente.googleId !== perfil.googleId || !usuarioExistente.email) {
        // Liberar si otra cuenta tenía este googleId
        await this.prisma.usuario.updateMany({
          where: {
            googleId: perfil.googleId,
            id_usuario: { not: usuarioExistente.id_usuario },
          },
          data: { googleId: null },
        });

        return this.prisma.usuario.update({
          where: { id_usuario: usuarioExistente.id_usuario },
          data: {
            googleId: perfil.googleId,
            ...(usuarioExistente.email ? {} : { email: emailNorm }),
          },
        });
      }
      return usuarioExistente;
    }

    // 4. Crear usuario nuevo con rol 'cliente' y estado activo si no estaba registrado previamente
    const baseUsername =
      emailNorm.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'cliente';
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
        email: emailNorm,
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

  // =========================================================================
  // CONTINGENCIA LOCAL Y ALTA DISPONIBILIDAD (FALLBACK / DISASTER RECOVERY)
  // Utilizado exclusivamente ante caídas de WAN/Internet o autenticación seed.
  // =========================================================================

  /**
   * Método de contingencia para autenticación local por usuario o correo.
   * Incluye passwordHash para verificación criptográfica mediante Argon2id.
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
}
