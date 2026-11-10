import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';
import { AuthService } from './auth.service';
import { GoogleLoginDto, LoginDto, UpdatePerfilDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =========================================================================
  // 1. FLUJO PRINCIPAL DE PRODUCCIÓN: AUTENTICACIÓN GOOGLE OAUTH 2.0 (SSO)
  // =========================================================================

  /**
   * POST /api/v1/auth/google
   * Autenticación federada mediante Google OAuth 2.0 (ID Token criptográfico).
   * Valida tokens de invitación (INV-XXXXXX) para enrolamiento privado de empleados.
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginConGoogle(googleLoginDto);
  }

  // =========================================================================
  // 2. GESTIÓN Y CONSULTA DE PERFIL DEL USUARIO EN SESIÓN
  // =========================================================================

  /**
   * GET /api/v1/auth/perfil
   * Retorna los datos del usuario autenticado a partir del token Bearer.
   */
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser('id_usuario') idUsuario: number) {
    return this.authService.obtenerPerfil(idUsuario);
  }

  /**
   * PATCH /api/v1/auth/perfil
   * Actualiza el perfil del usuario autenticado (nombre y/o contraseña de contingencia).
   */
  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() updatePerfilDto: UpdatePerfilDto,
  ) {
    return this.authService.actualizarPerfil(idUsuario, updatePerfilDto);
  }

  // =========================================================================
  // 3. FLUJO DE CONTINGENCIA LOCAL Y ALTA DISPONIBILIDAD (FALLBACK / DISASTER RECOVERY)
  // Utilizado exclusivamente ante caídas de WAN/Internet o inicialización seed.
  // =========================================================================

  /**
   * POST /api/v1/auth/login
   * Endpoint de contingencia para acceso local con credenciales hasheadas en Argon2id.
   * Protegido con ThrottlerGuard contra ataques de fuerza bruta (OWASP A04/A07).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
