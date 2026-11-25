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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../../common/decorators';
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
      'Registra un nuevo colaborador con su rol operativo (`administrador`, `cajero`, `mesero`, `cocina`, `cliente`) y genera un código único `INV-XXXXXX` válido por 48 horas para su activación con Google OAuth 2.0. ' +
      'Si se envía `correoEnvioCodigo`, despacha la invitación por correo electrónico sin persistir ese correo personal en la base de datos.\n\n' +
      '**Roles autorizados:** `administrador`.',
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
    description:
      'Despacha o reenvía por correo electrónico el código de invitación (`INV-XXXXXX`) vigente de un colaborador pendiente de vinculación. ' +
      'Por privacidad, la dirección destino se usa de forma efímera para el envío y no se almacena en base de datos.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del usuario colaborador', example: 2 })
  @ApiBody({ type: EnviarCodigoDto })
  @ApiResponse({ status: 200, description: 'Código despachado exitosamente.' })
  @ApiResponse({ status: 400, description: 'El usuario ya vinculó su cuenta o no tiene código activo.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Post(':id/enviar-codigo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
   * @returns Lista de usuarios registrados.
   */
  @ApiOperation({
    summary: 'Listar colaboradores con filtros de búsqueda',
    description:
      'Consulta la nómina de usuarios y colaboradores registrados, permitiendo filtrar por `rol`, `estado` (`activo`/`inactivo`) o término de búsqueda (`buscar` por nombre o alias).\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiResponse({ status: 200, description: 'Listado de usuarios obtenido exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
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
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description:
      'Recupera la ficha operativa de un usuario específico mediante su identificador numérico, incluyendo su rol, estado y código de invitación si está pendiente.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID único del usuario', example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario encontrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
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
  @ApiOperation({
    summary: 'Actualizar colaborador',
    description:
      'Actualiza parcialmente los datos administrativos de un colaborador (`nombre`, `usuario`, `email`, `rol`, `estado`), validando unicidad de alias y correo.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a modificar', example: 2 })
  @ApiBody({ type: UpdateUsuarioDto })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 409, description: 'El alias de usuario o correo ya se encuentra en uso.' })
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUsuarioDto,
    @CurrentUser('id_usuario') idActor?: number,
  ) {
    return this.usuariosService.actualizar(id, updateDto, idActor);
  }

  /**
   * Cambia el estado operativo de un colaborador (activo / inactivo).
   *
   * @param id Identificador del usuario.
   * @param cambiarEstadoDto Nuevo estado deseado.
   * @returns Usuario con estado actualizado.
   */
  @ApiOperation({
    summary: 'Cambiar estado (activar / desactivar colaborador)',
    description:
      'Habilita o inhabilita el acceso operativo de un usuario en el sistema (`activo` o `inactivo`) sin perder su historial de pedidos o facturas.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', example: 2 })
  @ApiBody({ type: CambiarEstadoDto })
  @ApiResponse({ status: 200, description: 'Estado modificado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoDto,
    @CurrentUser('id_usuario') idActor?: number,
  ) {
    return this.usuariosService.cambiarEstado(id, cambiarEstadoDto.estado, idActor);
  }

  /**
   * Desactiva (soft-delete) o elimina físicamente el usuario si no registra historial transaccional.
   *
   * @param id Identificador del usuario.
   * @returns Mensaje de confirmación de la operación.
   */
  @ApiOperation({
    summary: 'Eliminar o desactivar colaborador',
    description:
      'Evalúa la integridad referencial del usuario: si tiene pedidos, facturas, arqueos de caja, gastos o ajustes de inventario asociados aplica borrado lógico (`soft-delete` pasando a `inactivo`); si no tiene historial, realiza eliminación física (`hard-delete`).\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a remover', example: 3 })
  @ApiResponse({ status: 200, description: 'Usuario eliminado o desactivado según integridad referencial.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @Delete(':id')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id_usuario') idActor?: number,
  ) {
    return this.usuariosService.eliminar(id, idActor);
  }
}
