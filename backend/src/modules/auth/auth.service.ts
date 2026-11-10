import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { UsuariosService } from '../usuarios/usuarios.service';
import { GoogleLoginDto, LoginDto, UpdatePerfilDto } from './dto';
import { AuthResponse, AuthUserResponse, JwtPayload } from './interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('SecurityAudit');
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const clientIds = this.obtenerGoogleClientIds();
    this.googleClient = new OAuth2Client(clientIds[0] || undefined);

    // Margen de tolerancia de tiempo (clockSkew) para desincronizaciones del reloj del servidor
    const clockSkewSegundos =
      Number(this.configService.get('GOOGLE_CLOCK_SKEW_SECS')) || 300;
    (OAuth2Client as any).CLOCK_SKEW_SECS_ = clockSkewSegundos;
  }

  /**
   * Obtiene y normaliza los Google Client IDs configurados en las variables de entorno.
   * Limpia comillas circundantes, espacios y descarta valores placeholder de plantilla.
   */
  private obtenerGoogleClientIds(): string[] {
    const envVal =
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      process.env.GOOGLE_CLIENT_ID ||
      '';

    const limpio = envVal.replace(/^["']|["']$/g, '').trim();

    if (!limpio || limpio.includes('TU_GOOGLE_CLIENT_ID')) {
      return [];
    }

    return limpio
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && !id.includes('TU_GOOGLE_CLIENT_ID'));
  }

  // =========================================================================
  // 1. FLUJO PRINCIPAL DE PRODUCCIÓN: AUTENTICACIÓN GOOGLE OAUTH 2.0 (SSO)
  // Autenticación delegada federada, enrolamiento por invitación e inmutabilidad
  // =========================================================================

  /**
   * Autentica o registra un usuario mediante Google OAuth 2.0.
   * Valida criptográficamente el ID Token (JWT) con los certificados de Google.
   * Si se provee código de invitación, enrola al nuevo empleado; si ya existe, asocia su rol.
   */
  async loginConGoogle(googleDto: GoogleLoginDto): Promise<AuthResponse> {
    const rawToken =
      googleDto.idToken || googleDto.id_token || googleDto.credential;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      this.logger.warn(
        '[SECURITY_AUDIT] Intento fallido de login Google: No se proporcionó el token de autenticación (idToken / id_token / credential).',
      );
      throw new BadRequestException(
        'El token de autenticación de Google (ID Token) es obligatorio.',
      );
    }

    const tokenLimpio = rawToken.trim();

    // 1. Verificación de tipo de token: Asegurar que sea id_token (JWT) y no access_token (OAuth2)
    if (tokenLimpio.startsWith('ya29.')) {
      this.logger.warn(
        '[SECURITY_AUDIT] Intento fallido de login Google: Se envió un access_token de Google (inicia con "ya29.") en lugar del id_token (JWT).',
      );
      throw new BadRequestException(
        'Se recibió un access_token de Google en lugar de un ID Token (JWT). La verificación criptográfica con verifyIdToken requiere el id_token emitido por Google Identity Services.',
      );
    }

    const partesJwt = tokenLimpio.split('.');
    if (partesJwt.length !== 3) {
      this.logger.warn(
        `[SECURITY_AUDIT] Intento fallido de login Google: El token recibido no tiene formato JWT válido (${partesJwt.length} segmentos).`,
      );
      throw new UnauthorizedException(
        'El token de Google proporcionado no tiene la estructura de un ID Token (JWT) válido.',
      );
    }

    // 2. Obtener Client ID(s) válidos de las variables de entorno
    const clientIds = this.obtenerGoogleClientIds();
    if (clientIds.length === 0) {
      this.logger.error(
        '[SECURITY_AUDIT] Error de configuración: GOOGLE_CLIENT_ID no está configurado o contiene el valor de plantilla en el archivo .env del backend.',
      );
      throw new UnauthorizedException(
        'El inicio de sesión con Google no está configurado correctamente en el servidor. Configure GOOGLE_CLIENT_ID en backend/.env.',
      );
    }

    // 3. Verificación criptográfica con google-auth-library
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: tokenLimpio,
        audience: clientIds.length === 1 ? clientIds[0] : clientIds,
        maxExpiry: 86400, // 24 horas máximo de vigencia
      });
    } catch (error: any) {
      const mensajeError = error?.message || 'Token inválido o expirado';
      this.logger.warn(
        `[SECURITY_AUDIT] Intento fallido de login Google: ${mensajeError}`,
      );
      throw new UnauthorizedException(
        'Token de Google inválido o expirado. Por favor intenta iniciar sesión de nuevo.',
      );
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      this.logger.warn('[SECURITY_AUDIT] Intento fallido de login Google: Perfil sin correo.');
      throw new UnauthorizedException(
        'No se pudo obtener la información de perfil o el correo desde Google.',
      );
    }

    if (payload.email_verified === false) {
      this.logger.warn(`[SECURITY_AUDIT] Intento fallido de login Google: Correo no verificado '${payload.email}'.`);
      throw new UnauthorizedException(
        'El correo electrónico de tu cuenta Google no se encuentra verificado por Google.',
      );
    }

    const usuario = await this.usuariosService.vincularOGuardarGoogleUsuario({
      googleId: payload.sub,
      email: payload.email,
      nombre: payload.name || payload.email.split('@')[0],
      codigoInvitacion: googleDto.codigoInvitacion,
    });

    if (usuario.estado !== EstadoUsuario.activo) {
      this.logger.warn(`[SECURITY_AUDIT] Acceso denegado con Google: cuenta inactiva '${usuario.email}'.`);
      throw new UnauthorizedException(
        'El usuario se encuentra inactivo en el sistema. Contacte a la administración.',
      );
    }

    this.logger.log(`[SECURITY_AUDIT] Inicio de sesión exitoso con Google: '${usuario.email}' (Rol: ${usuario.rol}, ID: ${usuario.id_usuario})`);

    const jwtPayload: JwtPayload = {
      sub: usuario.id_usuario,
      usuario: usuario.usuario,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    return {
      accessToken,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        usuario: usuario.usuario,
        email: usuario.email ?? undefined,
        rol: usuario.rol,
        estado: usuario.estado,
      },
    };
  }

  // =========================================================================
  // 2. GESTIÓN Y CONSULTA DE PERFIL PROPIO
  // =========================================================================

  /**
   * Retorna los datos actualizados del perfil de usuario autenticado.
   */
  async obtenerPerfil(id_usuario: number) {
    return this.usuariosService.obtenerPorId(id_usuario);
  }

  /**
   * Actualiza los datos del perfil del usuario autenticado (nombre y/o contraseña de contingencia).
   */
  async actualizarPerfil(id_usuario: number, dto: UpdatePerfilDto) {
    return this.usuariosService.actualizar(id_usuario, {
      nombre: dto.nombre,
      password: dto.password,
    });
  }

  // =========================================================================
  // 3. MECANISMO DE CONTINGENCIA LOCAL Y ALTA DISPONIBILIDAD (DISASTER RECOVERY)
  // Utilizado como respaldo ante corte de WAN/Internet o para inicialización seed.
  // =========================================================================

  /**
   * Valida credenciales locales contra la base de datos verificando el hash Argon2id (OWASP).
   * Arroja UnauthorizedException si las credenciales no coinciden o el usuario está inactivo.
   */
  async validarUsuario(
    username: string,
    passwordPlano: string,
  ): Promise<AuthUserResponse> {
    const usuario =
      await this.usuariosService.obtenerPorUsernameParaAuth(username);

    if (!usuario) {
      this.logger.warn(`[SECURITY_AUDIT] Intento fallido de autenticación: usuario '${username}' no encontrado.`);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (usuario.estado !== EstadoUsuario.activo) {
      this.logger.warn(`[SECURITY_AUDIT] Intento de acceso denegado: cuenta inactiva '${username}'.`);
      throw new UnauthorizedException(
        'El usuario se encuentra inactivo en el sistema. Contacte a la administración.',
      );
    }

    if (!usuario.passwordHash) {
      this.logger.warn(`[SECURITY_AUDIT] Intento de inicio por contraseña en cuenta vinculada exclusivamente a Google: '${username}'.`);
      throw new UnauthorizedException(
        'Esta cuenta está vinculada exclusivamente con Google OAuth 2.0. Por favor inicia sesión usando el botón de Google.',
      );
    }

    const esPasswordValido = await argon2.verify(
      usuario.passwordHash,
      passwordPlano,
    );

    if (!esPasswordValido) {
      this.logger.warn(`[SECURITY_AUDIT] Intento fallido de autenticación: contraseña errónea para '${username}'.`);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      email: usuario.email ?? undefined,
      rol: usuario.rol,
      estado: usuario.estado,
    };
  }

  /**
   * Autentica al usuario mediante credenciales locales de contingencia y emite un token JWT.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const usuario = await this.validarUsuario(
      loginDto.usuario,
      loginDto.password,
    );

    this.logger.log(`[SECURITY_AUDIT] Inicio de sesión exitoso por contingencia local: '${usuario.usuario}' (Rol: ${usuario.rol}, ID: ${usuario.id_usuario})`);

    const payload: JwtPayload = {
      sub: usuario.id_usuario,
      usuario: usuario.usuario,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      usuario,
    };
  }
}
