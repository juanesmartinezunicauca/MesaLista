import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoDto,
  CreateUsuarioDto,
  EnviarCodigoDto,
  QueryUsuarioDto,
  UpdateUsuarioDto,
} from './dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.administrador)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * POST /api/v1/usuarios
   * Crea un nuevo colaborador en el sistema (gestión exclusiva de administración).
   * - Flujo Principal (Google SSO): Genera un código de invitación unívoco (INV-XXXXXX) para enrolamiento delegado sin contraseña.
   * - Envío de Código: Si se proporciona correoEnvioCodigo o email de colaborador, se envía el código sin persistir el correo en BD.
   * - Flujo de Contingencia: Acepta opcionalmente contraseña hasheada en Argon2id para cuentas maestras o de respaldo local.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.crear(createUsuarioDto);
  }

  /**
   * POST /api/v1/usuarios/:id/enviar-codigo
   * Despacha el código de invitación a un correo electrónico temporal solicitado.
   * GARANTÍA DE PRIVACIDAD: Este correo no se almacena en la base de datos.
   */
  @Post(':id/enviar-codigo')
  @HttpCode(HttpStatus.OK)
  enviarCodigo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnviarCodigoDto,
  ) {
    return this.usuariosService.enviarCodigoPorCorreo(id, dto.correoDestino);
  }

  /**
   * GET /api/v1/usuarios
   * Lista usuarios con filtros opcionales (rol, estado, buscar).
   */
  @Get()
  obtenerTodos(@Query() query: QueryUsuarioDto) {
    return this.usuariosService.obtenerTodos(query);
  }

  /**
   * GET /api/v1/usuarios/:id
   * Obtiene la información de un usuario por su ID.
   */
  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerPorId(id);
  }

  /**
   * PATCH /api/v1/usuarios/:id
   * Actualiza parcialmente un usuario.
   */
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.actualizar(id, updateDto);
  }

  /**
   * PATCH /api/v1/usuarios/:id/estado
   * Modifica el estado activo/inactivo del usuario.
   */
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoDto,
  ) {
    return this.usuariosService.cambiarEstado(id, cambiarEstadoDto.estado);
  }

  /**
   * DELETE /api/v1/usuarios/:id
   * Desactiva (soft-delete) o elimina físicamente el usuario si no tiene historial.
   */
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.eliminar(id);
  }
}
