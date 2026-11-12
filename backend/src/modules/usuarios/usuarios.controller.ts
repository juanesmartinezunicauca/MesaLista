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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

/**
 * Controlador de Gestión de Usuarios y Personal Operativo
 * Protegido exclusivamente para el rol Super Administrador.
 */
@ApiTags('Usuarios')
@ApiBearerAuth('JWT-auth')
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.administrador)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * Crea un nuevo colaborador en el sistema.
   * Genera un código de invitación unívoco (INV-XXXXXX) para enrolamiento delegado sin contraseña.
   * Si se incluye correoEnvioCodigo, despacha el código por Brevo API sin persistir el correo en BD.
   *
   * @param createUsuarioDto Datos del colaborador (nombre, alias opcional, rol, correo efímero).
   * @returns Ficha del colaborador creado con código de activación.
   */
  @ApiOperation({
    summary: 'Crear nuevo colaborador y generar código de invitación',
    description:
      'Registra al colaborador con su rol operativo. Genera un código INV-XXXXXX válido por 48h para vinculación con Google SSO.',
  })
  @ApiBody({ type: CreateUsuarioDto })
  @ApiResponse({ status: 201, description: 'Colaborador creado exitosamente con su código de invitación.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o incompletos en el formulario.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 409, description: 'El nombre de usuario o correo ya se encuentra registrado.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.crear(createUsuarioDto);
  }

  /**
   * Despacha o reenvía el código de invitación a un correo solicitado.
   * Por garantía de privacidad, el correo no se almacena en la base de datos.
   *
   * @param id Identificador numérico del usuario.
   * @param dto Correo de destino efímero.
   * @returns Estado de entrega del correo.
   */
  @ApiOperation({
    summary: 'Enviar o reenviar código de invitación por correo electrónico',
    description: 'Despacha el código a un correo efímero sin almacenarlo en base de datos.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 2 })
  @ApiBody({ type: EnviarCodigoDto })
  @ApiResponse({ status: 200, description: 'Código despachado exitosamente.' })
  @ApiResponse({ status: 400, description: 'El usuario ya vinculó su cuenta o no tiene código activo.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Post(':id/enviar-codigo')
  @HttpCode(HttpStatus.OK)
  enviarCodigo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnviarCodigoDto,
  ) {
    return this.usuariosService.enviarCodigoPorCorreo(id, dto.correoDestino);
  }

  /**
   * Consulta el listado de usuarios con filtros opcionales.
   *
   * @param query Filtros por rol, estado y búsqueda por nombre o usuario.
   * @returns Lista de usuarios sin exponer hashes de contraseña.
   */
  @ApiOperation({
    summary: 'Listar colaboradores con filtros de búsqueda',
    description: 'Permite filtrar el personal por rol operativo, estado (activo/inactivo) o texto libre.',
  })
  @ApiResponse({ status: 200, description: 'Listado de usuarios obtenido exitosamente.' })
  @Get()
  obtenerTodos(@Query() query: QueryUsuarioDto) {
    return this.usuariosService.obtenerTodos(query);
  }

  /**
   * Consulta la información detallada de un usuario por su ID.
   *
   * @param id Identificador numérico del usuario.
   * @returns Ficha completa del usuario.
   */
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiParam({ name: 'id', description: 'ID único del usuario', example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario encontrado.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerPorId(id);
  }

  /**
   * Actualiza parcialmente la información de un colaborador.
   *
   * @param id Identificador del usuario.
   * @param updateDto Campos a modificar.
   * @returns Usuario actualizado.
   */
  @ApiOperation({ summary: 'Actualizar colaborador' })
  @ApiParam({ name: 'id', description: 'ID del usuario a modificar', example: 2 })
  @ApiBody({ type: UpdateUsuarioDto })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.actualizar(id, updateDto);
  }

  /**
   * Cambia el estado operativo de un colaborador (activo / inactivo).
   *
   * @param id Identificador del usuario.
   * @param cambiarEstadoDto Nuevo estado deseado.
   * @returns Usuario con estado actualizado.
   */
  @ApiOperation({ summary: 'Cambiar estado (activar / desactivar colaborador)' })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 2 })
  @ApiBody({ type: CambiarEstadoDto })
  @ApiResponse({ status: 200, description: 'Estado modificado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoDto,
  ) {
    return this.usuariosService.cambiarEstado(id, cambiarEstadoDto.estado);
  }

  /**
   * Desactiva (soft-delete) o elimina físicamente el usuario si no registra historial transaccional.
   *
   * @param id Identificador del usuario.
   * @returns Mensaje de confirmación de la operación.
   */
  @ApiOperation({ summary: 'Eliminar o desactivar colaborador' })
  @ApiParam({ name: 'id', description: 'ID del usuario a remover', example: 3 })
  @ApiResponse({ status: 200, description: 'Usuario eliminado o desactivado según integridad referencial.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.eliminar(id);
  }
}
