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
    rol: true,
    estado: true,
  } as const;

  /**
   * Registra un nuevo usuario con contraseña hasheada mediante Argon2id (OWASP).
   */
  async crear(createUsuarioDto: CreateUsuarioDto) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { usuario: createUsuarioDto.usuario },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        `El nombre de usuario '${createUsuarioDto.usuario}' ya está en uso.`,
      );
    }

    // Configuración recomendada por OWASP para Argon2id
    const passwordHash = await argon2.hash(createUsuarioDto.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 iteraciones
      parallelism: 4,
    });

    return this.prisma.usuario.create({
      data: {
        nombre: createUsuarioDto.nombre,
        usuario: createUsuarioDto.usuario,
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
   */
  async obtenerPorUsernameParaAuth(usuario: string) {
    return this.prisma.usuario.findUnique({
      where: { usuario },
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
