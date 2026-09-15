import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Endpoint público con protección de rate limiting (M-02: ThrottlerGuard contra fuerza bruta).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * GET /api/v1/auth/perfil
   * Retorna los datos del usuario autenticado a partir del token Bearer.
   */
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil(@CurrentUser('id_usuario') idUsuario: number) {
    return this.authService.obtenerPerfil(idUsuario);
  }
}
