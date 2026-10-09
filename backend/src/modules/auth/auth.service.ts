import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EstadoUsuario } from '@prisma/client';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { UsuariosService } from '../usuarios/usuarios.service';
import { GoogleLoginDto, LoginDto, UpdatePerfilDto } from './dto';
import {
  AuthResponse,
  AuthUserResponse,
  JwtPayload,
} from './interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('SecurityAudit');
  private googleClient: OAuth2Client;

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(clientId);
  }

  /**
   * Valida credenciales contra la base de datos verificando el hash Argon2id (OWASP).
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
      this.logger.warn(`[SECURITY_AUDIT] Intento de inicio por contraseña en cuenta Google: '${username}'.`);
      throw new UnauthorizedException(
        'Esta cuenta está vinculada con Google OAuth 2.0. Por favor inicia sesión usando el botón de Google.',
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
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
    };
  }

  /**
   * Autentica al usuario y emite un token JWT con tiempo de expiración configurable.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const usuario = await this.validarUsuario(
      loginDto.usuario,
      loginDto.password,
    );

    this.logger.log(`[SECURITY_AUDIT] Inicio de sesión exitoso: '${usuario.usuario}' (Rol: ${usuario.rol}, ID: ${usuario.id_usuario})`);

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

  /**
   * Autentica o registra un usuario mediante Google OAuth 2.0.
   * Valida criptográficamente el ID Token con los servidores de Google.
   */
  async loginConGoogle(googleDto: GoogleLoginDto): Promise<AuthResponse> {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: googleDto.idToken,
        audience: googleClientId || undefined,
      });
    } catch (error) {
      this.logger.warn('[SECURITY_AUDIT] Intento fallido de login Google: Token inválido o expirado.');
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
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
      },
    };
  }

  /**
   * Retorna los datos actualizados del perfil de usuario autenticado.
   */
  async obtenerPerfil(id_usuario: number) {
    return this.usuariosService.obtenerPorId(id_usuario);
  }

  /**
   * Actualiza los datos del perfil del usuario autenticado (nombre y/o contraseña).
   */
  async actualizarPerfil(id_usuario: number, dto: UpdatePerfilDto) {
    return this.usuariosService.actualizar(id_usuario, {
      nombre: dto.nombre,
      password: dto.password,
    });
  }
}

