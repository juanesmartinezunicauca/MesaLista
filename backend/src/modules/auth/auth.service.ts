import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstadoUsuario } from '@prisma/client';
import * as argon2 from 'argon2';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto, UpdatePerfilDto } from './dto';
import {
  AuthResponse,
  AuthUserResponse,
  JwtPayload,
} from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) { }

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
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (usuario.estado !== EstadoUsuario.activo) {
      throw new UnauthorizedException(
        'El usuario se encuentra inactivo en el sistema. Contacte a la administración.',
      );
    }

    const esPasswordValido = await argon2.verify(
      usuario.passwordHash,
      passwordPlano,
    );

    if (!esPasswordValido) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
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
