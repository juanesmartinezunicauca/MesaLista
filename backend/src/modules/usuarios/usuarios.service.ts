import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUsuarioDto,
  EstadoUsuario,
  QueryUsuarioDto,
  RolUsuario,
  UpdateUsuarioDto,
} from './dto';

/**
 * Genera un código de invitación unívoco y criptográficamente seguro
 * Utiliza Base32 Crockford (32 símbolos legibles, sin 0, 1, I, O)
 * 8 caracteres => 32^8 = 1.099.511.627.776 combinaciones (~35 bits de entropía)
 */
function generarCodigoInvitacionSeguro(): string {
  const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return `INV-${codigo}`;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Genera el código de invitación unívoco para nuevos colaboradores.
   */
  generarCodigoInvitacion(): string {
    return generarCodigoInvitacionSeguro();
  }

  // Proyección que excluye deliberadamente el hash de contraseña de las respuestas
  private readonly usuarioSelectSinPassword = {
    id_usuario: true,
    nombre: true,
    usuario: true,
    email: true,
    rol: true,
    estado: true,
    codigoInvitacion: true,
    codigoInvitacionExpira: true,
  } as const;

  /**
   * Registra un nuevo colaborador en el sistema.
   * REGLA DE PRIVACIDAD OBLIGATORIA:
   * El correo suministrado para la entrega del código de registro (correoEnvioCodigo o email de colaborador)
   * se utiliza EXCLUSIVAMENTE para enviar el código por correo y NO se persiste en la base de datos (queda en null).
   */
  async crear(createUsuarioDto: CreateUsuarioDto) {
    const esColaboradorOperativo = createUsuarioDto.rol !== RolUsuario.cliente;

    // Correo efímero para envío del código
    const correoParaDespacho = (
      createUsuarioDto.correoEnvioCodigo ||
      (esColaboradorOperativo ? createUsuarioDto.email : undefined)
    )?.trim().toLowerCase() || null;

    // Si es colaborador operativo, el email en base de datos NO se guarda (null) para preservar su privacidad
    const emailAGuardar = esColaboradorOperativo
      ? null
      : (createUsuarioDto.email ? createUsuarioDto.email.trim().toLowerCase() : null);

    // Validar si el email a guardar ya existe (solo cuando aplica guardar)
    if (emailAGuardar) {
      const emailExistente = await this.prisma.usuario.findUnique({
        where: { email: emailAGuardar },
      });

      if (emailExistente) {
        throw new ConflictException(
          `El correo electrónico '${emailAGuardar}' ya está registrado.`,
        );
      }
    }

    // Resolver username: si no viene especificado, se deriva del correo efímero o del nombre
    let finalUsername = createUsuarioDto.usuario?.trim();
    if (!finalUsername) {
      const base = correoParaDespacho
        ? correoParaDespacho.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40)
        : createUsuarioDto.nombre.trim().toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'colaborador';
      finalUsername = base;
      let counter = 1;
      while (counter <= 20 && (await this.prisma.usuario.findUnique({ where: { usuario: finalUsername } }))) {
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

    // Generar código de invitación seguro y con expiración para roles operativos
    let codigoInvitacion: string | null = null;
    let codigoInvitacionExpira: Date | null = null;

    if (esColaboradorOperativo) {
      let intentos = 0;
      while (intentos < 10) {
        const codigoCandidato = this.generarCodigoInvitacion();
        const existe = await this.prisma.usuario.findFirst({
          where: { codigoInvitacion: codigoCandidato },
        });
        if (!existe) {
          codigoInvitacion = codigoCandidato;
          break;
        }
        intentos++;
      }

      if (!codigoInvitacion) {
        throw new ConflictException(
          'No se pudo generar un código de invitación único tras varios intentos. Inténtelo nuevamente.',
        );
      }

      // Vigencia del código temporal: 48 horas
      codigoInvitacionExpira = new Date(Date.now() + 48 * 60 * 60 * 1000);
    }

    // Hashear contraseña solo si se especificó explícitamente (cuenta tradicional)
    let passwordHash: string | null = null;
    if (createUsuarioDto.password && createUsuarioDto.password.trim()) {
      passwordHash = await argon2.hash(createUsuarioDto.password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iteraciones
        parallelism: 4,
      });
    }

    const nuevoUsuario = await this.prisma.usuario.create({
      data: {
        nombre: createUsuarioDto.nombre.trim(),
        usuario: finalUsername,
        email: emailAGuardar, // NULL para colaboradores operativos: ¡NO SE GUARDA EN BD!
        passwordHash,
        codigoInvitacion,
        codigoInvitacionExpira,
        rol: createUsuarioDto.rol,
        estado: createUsuarioDto.estado ?? EstadoUsuario.activo,
      },
      select: this.usuarioSelectSinPassword,
    });

    // Despacho del código por correo si se especificó destinatario
    let despachoMail: any = null;
    if (correoParaDespacho && codigoInvitacion) {
      despachoMail = await this.mailService.enviarCodigoInvitacion(correoParaDespacho, {
        nombre: nuevoUsuario.nombre,
        rol: nuevoUsuario.rol,
        codigo: codigoInvitacion,
      });
    }

    return {
      ...nuevoUsuario,
      correoEnviado: Boolean(despachoMail?.enviado),
      correoDestino: correoParaDespacho,
      transport: despachoMail?.transport,
      mensajeCorreo: despachoMail?.mensaje,
      errorSmtp: despachoMail?.errorSmtp,
      guardadoEnBaseDeDatos: false, // Declaración explícita para auditoría
    };
  }

  /**
   * Envía (o reenvía) el código de invitación de un usuario al correo electrónico suministrado.
   * GARANTÍA DE PRIVACIDAD: El correo de destino NO se almacena en la base de datos.
   */
  async enviarCodigoPorCorreo(idUsuario: number, correoDestino: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID #${idUsuario} no encontrado.`);
    }

    if (!usuario.codigoInvitacion) {
      throw new BadRequestException(
        `El colaborador '${usuario.nombre}' ya ha vinculado su cuenta o no tiene un código de registro activo.`,
      );
    }

    let codigoAEnviar = usuario.codigoInvitacion;
    // Si el código ya venció, regenerar uno nuevo con 48h de vigencia
    if (usuario.codigoInvitacionExpira && usuario.codigoInvitacionExpira < new Date()) {
      codigoAEnviar = this.generarCodigoInvitacion();
      const nuevaExpira = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await this.prisma.usuario.update({
        where: { id_usuario: idUsuario },
        data: {
          codigoInvitacion: codigoAEnviar,
          codigoInvitacionExpira: nuevaExpira,
        },
      });
    }

    const emailNorm = correoDestino.trim().toLowerCase();

    const resultado = await this.mailService.enviarCodigoInvitacion(emailNorm, {
      nombre: usuario.nombre,
      rol: usuario.rol,
      codigo: codigoAEnviar,
    });

    return {
      success: Boolean(resultado.enviado),
      mensaje: resultado.mensaje,
      destinatario: emailNorm,
      guardadoEnBaseDeDatos: false,
      transport: resultado.transport,
      errorSmtp: (resultado as any).errorSmtp,
      smtpConfigurado: (resultado as any).smtpConfigurado,
    };
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
   * Vincula una cuenta de Google OAuth existente por código de invitación o googleId,
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

    // 1. Si se suministró un código de invitación, canjearlo atómicamente y vincular al colaborador
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

      // Validar si el código ha expirado
      if (
        usuarioInvitado.codigoInvitacionExpira &&
        usuarioInvitado.codigoInvitacionExpira < new Date()
      ) {
        throw new UnauthorizedException(
          'El código de invitación ha expirado. Por favor solicita uno nuevo a la administración.',
        );
      }

      // Quema atómica del código (Race condition prevention: solo 1 petición concurrente gana)
      const quema = await this.prisma.usuario.updateMany({
        where: {
          id_usuario: usuarioInvitado.id_usuario,
          codigoInvitacion: codigoNormalizado,
        },
        data: {
          codigoInvitacion: null,
          codigoInvitacionExpira: null,
        },
      });

      if (quema.count === 0) {
        throw new UnauthorizedException(
          'El código de invitación ya fue utilizado en otra sesión concurrente.',
        );
      }

      // Si el empleado antes había ingresado como cliente (creando una cuenta cliente previa con ese email/googleId),
      // debemos liberar los identificadores de esa cuenta cliente para evitar error P2002 de unicidad.
      const cuentaPrevia = await this.prisma.usuario.findFirst({
        where: {
          OR: [
            { email: { equals: emailNorm, mode: 'insensitive' } },
            { googleId: perfil.googleId },
          ],
          id_usuario: { not: usuarioInvitado.id_usuario },
        },
      });

      if (cuentaPrevia && cuentaPrevia.id_usuario !== usuarioInvitado.id_usuario) {
        if (cuentaPrevia.rol === RolUsuario.cliente) {
          // Es una cuenta temporal o de cliente previa: liberar email y googleId
          await this.prisma.usuario.update({
            where: { id_usuario: cuentaPrevia.id_usuario },
            data: {
              googleId: null,
              email: null,
            },
          });
        } else {
          throw new ConflictException(
            'Esta cuenta de Google ya se encuentra asociada a otro colaborador en el sistema.',
          );
        }
      }

      // Liberar googleId de cualquier otra fila por seguridad
      await this.prisma.usuario.updateMany({
        where: {
          googleId: perfil.googleId,
          id_usuario: { not: usuarioInvitado.id_usuario },
        },
        data: { googleId: null },
      });

      // Vincular el empleado con su Google ID y su email
      return this.prisma.usuario.update({
        where: { id_usuario: usuarioInvitado.id_usuario },
        data: {
          googleId: perfil.googleId,
          email: emailNorm,
          codigoInvitacion: null,
          codigoInvitacionExpira: null,
        },
      });
    }

    // 2. Si NO viene código de invitación (login regular con Google):
    // REGLA DE SEGURIDAD ESTRICTA:
    // Nunca vincular colaboradores operativos por nombre o prefijo de email sin código.
    // Solo se permite ingreso si:
    // A) Ya tiene este googleId registrado
    const usuarioPorGoogle = await this.prisma.usuario.findFirst({
      where: { googleId: perfil.googleId },
    });

    if (usuarioPorGoogle) {
      return usuarioPorGoogle;
    }

    // B) Coincide exactamente con el email registrado en base de datos
    const usuarioPorEmail = await this.prisma.usuario.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
    });

    if (usuarioPorEmail) {
      // Si el usuario ya tiene un googleId diferente, no permitir secuestro ni sobreescritura
      if (usuarioPorEmail.googleId && usuarioPorEmail.googleId !== perfil.googleId) {
        throw new UnauthorizedException(
          'Este usuario ya se encuentra vinculado a otra cuenta de Google distinta.',
        );
      }

      // Si no tenía googleId (ej. registrado por cuenta tradicional), enlazárselo
      return this.prisma.usuario.update({
        where: { id_usuario: usuarioPorEmail.id_usuario },
        data: { googleId: perfil.googleId },
      });
    }

    // C) Si no existe por googleId ni por email, es un cliente nuevo:
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
