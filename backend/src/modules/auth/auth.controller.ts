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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';
import { AuthService } from './auth.service';
import { GoogleLoginDto, UpdatePerfilDto } from './dto';

/**
 * Controlador de Autenticación y Gestión de Sesión
 * Expone los endpoints de federación con Google OAuth 2.0 y perfil de usuario.
 */
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =========================================================================
  // 1. FLUJO PRINCIPAL DE PRODUCCIÓN: AUTENTICACIÓN GOOGLE OAUTH 2.0 (SSO)
  // =========================================================================

  /**
   * Inicia sesión o activa cuenta mediante Google OAuth 2.0
   * 
   * Valida criptográficamente el ID Token emitido por Google con las claves públicas oficiales (JWKS).
   * Si se incluye un código de invitación válido (`INV-XXXXXX`), vincula al colaborador con su perfil operativo.
   * Si es un cliente nuevo sin código, crea automáticamente su cuenta pública con rol cliente.
   *
   * @param googleLoginDto Contiene el idToken/credential de Google y código opcional de invitación.
   * @returns Objeto con tokens JWT (accessToken) y perfil del usuario autenticado.
   */
  @ApiOperation({
    summary: 'Autenticación con Google OAuth 2.0 (Google Identity Services)',
    description:
      'Verifica criptográficamente el ID Token (JWT) emitido por Google usando las claves públicas oficiales (JWKS) y valida audiencia/correo verificado. ' +
      'Si el usuario adjunta un código de invitación vigente (`INV-XXXXXX`), vincula su cuenta Google al perfil de colaborador pre-autorizado y su rol asignado; ' +
      'si es un usuario nuevo sin código, crea automáticamente una cuenta con rol `cliente`. Emite el JWT `accessToken` de sesión.\n\n' +
      '**Acceso:** Público (protegido con rate limiting mediante ThrottlerGuard).',
  })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa. Retorna accessToken y datos del usuario.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        usuario: {
          id_usuario: 1,
          nombre: 'Juan Esteban Martinez',
          usuario: 'admin',
          email: 'jesmartinez@unicauca.edu.co',
          rol: 'administrador',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token mal formado o access_token OAuth enviado en lugar de id_token JWT.' })
  @ApiResponse({ status: 401, description: 'Token de Google inválido, expirado, código de invitación inválido/vencido o usuario inactivo.' })
  @ApiResponse({ status: 500, description: 'Error interno en la base de datos o fallo en el servicio de tokens.' })
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
   * Obtiene la información del perfil del usuario actualmente autenticado
   *
   * @param idUsuario Identificador del usuario extraído automáticamente del token JWT Bearer.
   * @returns Datos del usuario sin exponer hashes ni credenciales sensibles.
   */
  @ApiOperation({
    summary: 'Consultar perfil del usuario autenticado',
    description:
      'Extrae el identificador del usuario desde el Bearer Token JWT y retorna su ficha actualizada desde base de datos ' +
      '(id, nombre, alias de usuario, email, rol operativo y estado).\n\n' +
      '**Acceso:** Cualquier usuario autenticado (`JwtAuthGuard`).',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario recuperado exitosamente.',
    schema: {
      example: {
        id_usuario: 1,
        nombre: 'Juan Esteban Martinez',
        usuario: 'admin',
        email: 'jesmartinez@unicauca.edu.co',
        rol: 'administrador',
        estado: 'activo',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token no suministrado o inválido.' })
  @ApiResponse({ status: 404, description: 'El usuario ya no existe en el sistema.' })
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser('id_usuario') idUsuario: number) {
    return this.authService.obtenerPerfil(idUsuario);
  }

  /**
   * Actualiza el perfil propio del usuario en sesión
   *
   * @param idUsuario Identificador del usuario autenticado.
   * @param updatePerfilDto Datos a modificar (nombre visible).
   * @returns Perfil actualizado.
   */
  @ApiOperation({
    summary: 'Actualizar perfil del usuario autenticado',
    description:
      'Permite al usuario en sesión modificar su propio nombre visible (`nombre`) sin alterar su rol, estado ni vinculación de cuenta Google.\n\n' +
      '**Acceso:** Cualquier usuario autenticado (`JwtAuthGuard`).',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: UpdatePerfilDto })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Formato de nombre inválido.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() updatePerfilDto: UpdatePerfilDto,
  ) {
    return this.authService.actualizarPerfil(idUsuario, updatePerfilDto);
  }
}
