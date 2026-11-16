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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoDomicilioDto,
  CambiarRecepcionDomiciliosDto,
  CancelarDomicilioDto,
  CreateDomicilioDto,
  SaveRepartidorDto,
  UpdateDomicilioDto,
} from './dto';
import { DomiciliosService } from './domicilios.service';

/**
 * Controlador de Pedidos a Domicilio y Directorio de Repartidores
 * Permite tanto la toma de pedidos por clientes públicos/operación como el seguimiento de repartos.
 */
@ApiTags('Domicilios')
@Controller('domicilios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomiciliosController {
  constructor(private readonly domiciliosService: DomiciliosService) {}

  /**
   * Consulta pública del estado de recepción de domicilios (abierto/cerrado).
   *
   * @returns Estado actual del servicio de domicilios y motivo si está cerrado.
   */
  @ApiOperation({
    summary: 'Consultar estado público de recepción de domicilios',
    description:
      'Informa en tiempo real a la vista pública de clientes y al POS si el restaurante está recibiendo pedidos a domicilio (`recibiendo: true/false`) junto con el motivo si el canal se encuentra pausado.\n\n' +
      '**Acceso:** Público (`@Public`).',
  })
  @ApiResponse({ status: 200, description: 'Estado del servicio recuperado exitosamente.' })
  @Public()
  @Get('estado-servicio')
  obtenerEstadoServicio() {
    return this.domiciliosService.obtenerEstadoServicio();
  }

  /**
   * Modifica la recepción de pedidos a domicilio (abrir o pausar servicio).
   *
   * @param dto Booleano de recepción y motivo opcional.
   * @returns Nuevo estado del servicio.
   */
  @ApiOperation({
    summary: 'Abrir o pausar recepción de domicilios',
    description:
      'Activa o pausa globalmente la recepción de nuevos pedidos a domicilio en el portal de clientes, registrando un motivo informativo opcional para mostrar al público.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CambiarRecepcionDomiciliosDto })
  @ApiResponse({ status: 200, description: 'Recepción actualizada exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Patch('estado-servicio')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cambiarRecepcionDomicilios(@Body() dto: CambiarRecepcionDomiciliosDto) {
    return this.domiciliosService.cambiarRecepcionDomicilios(dto.recibiendo, dto.motivo);
  }

  /**
   * Consulta el directorio de repartidores registrados.
   *
   * @returns Lista de repartidores operativos.
   */
  @ApiOperation({
    summary: 'Listar repartidores del directorio',
    description:
      'Obtiene el directorio de domiciliarios/repartidores registrados con su nombre, teléfono, vehículo y estado activo para asignarlos en los despachos.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Directorio de repartidores obtenido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Get('repartidores')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerRepartidores() {
    return this.domiciliosService.obtenerRepartidores();
  }

  /**
   * Guarda o actualiza un repartidor en el directorio operativo.
   *
   * @param body Ficha del repartidor (nombre, teléfono, vehículo).
   * @returns Ficha guardada.
   */
  @ApiOperation({
    summary: 'Guardar o actualizar repartidor',
    description:
      'Crea un nuevo repartidor en el directorio operativo o actualiza uno existente si se suministra su `id` (nombre, teléfono de contacto, vehículo y disponibilidad).\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: SaveRepartidorDto })
  @ApiResponse({ status: 200, description: 'Repartidor guardado correctamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos para el repartidor.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Post('repartidores')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  guardarRepartidor(@Body() body: SaveRepartidorDto) {
    return this.domiciliosService.guardarRepartidor(body);
  }

  /**
   * Elimina un repartidor del directorio.
   *
   * @param id Identificador del repartidor.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({
    summary: 'Eliminar repartidor',
    description:
      'Elimina un registro del directorio operativo de repartidores mediante su identificador.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del repartidor', example: 'rep-1' })
  @ApiResponse({ status: 200, description: 'Repartidor eliminado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Repartidor no encontrado.' })
  @Delete('repartidores/:id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  eliminarRepartidor(@Param('id') id: string) {
    return this.domiciliosService.eliminarRepartidor(id);
  }

  /**
   * Crea un nuevo pedido a domicilio con datos del cliente y congelamiento de precios.
   *
   * @param createDto Datos de cliente, dirección e ítems.
   * @param id_usuario Identificador del usuario que registra el pedido (cliente o colaborador).
   * @returns Domicilio creado en estado 'enviada'.
   */
  @ApiOperation({
    summary: 'Crear pedido a domicilio',
    description:
      'Registra un pedido con entrega a domicilio desde el portal de clientes o el POS del restaurante. Verifica que el servicio esté habilitado, congela los precios del catálogo, valida existencias y descuenta inventario automáticamente.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`, `cliente`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateDomicilioDto })
  @ApiResponse({ status: 201, description: 'Pedido a domicilio creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Servicio pausado, datos incompletos o stock insuficiente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cliente,
  )
  crear(
    @Body() createDto: CreateDomicilioDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.domiciliosService.crear(createDto, id_usuario);
  }

  /**
   * Consulta el listado general de pedidos a domicilio con filtros.
   *
   * @param estado Filtro por estado operativo.
   * @param fecha Filtro por fecha (YYYY-MM-DD).
   * @param buscar Término de búsqueda de cliente o teléfono.
   * @returns Lista de pedidos a domicilio.
   */
  @ApiOperation({
    summary: 'Listar pedidos a domicilio con filtros',
    description:
      'Consulta todos los pedidos a domicilio para el tablero de despacho del restaurante, con filtros opcionales por estado operativo, fecha y búsqueda por cliente o teléfono.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'estado', required: false, description: 'Filtrar por estado operativo' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha exacta YYYY-MM-DD' })
  @ApiQuery({ name: 'fecha_inicio', required: false, description: 'Fecha inicial del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_fin', required: false, description: 'Fecha final del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'buscar', required: false, description: 'Búsqueda por nombre o teléfono de cliente' })
  @ApiResponse({ status: 200, description: 'Listado de domicilios obtenido.' })
  @ApiResponse({ status: 400, description: 'Formato o rango de fecha inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodos(
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
    @Query('buscar') buscar?: string,
    @Query('fecha_inicio') fecha_inicio?: string,
    @Query('fecha_fin') fecha_fin?: string,
  ) {
    return this.domiciliosService.obtenerTodos({
      estado,
      fecha,
      buscar,
      ...(fecha_inicio ? { fecha_inicio } : {}),
      ...(fecha_fin ? { fecha_fin } : {}),
    });
  }

  /**
   * Consulta los pedidos del cliente autenticado.
   *
   * @param id_usuario Identificador del cliente extraído del token JWT.
   * @returns Lista de pedidos realizados por el cliente.
   */
  @ApiOperation({
    summary: 'Consultar mis pedidos a domicilio (Portal Cliente)',
    description:
      'Retorna exclusivamente el historial y estado en tiempo real de los pedidos a domicilio vinculados al usuario autenticado en el token JWT.\n\n' +
      '**Roles autorizados:** `cliente`, `administrador`, `cajero`, `mesero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Historial personal de pedidos del cliente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @Get('mis-pedidos')
  @Roles(RolUsuario.cliente, RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerMisPedidos(@CurrentUser('id_usuario') id_usuario: number) {
    return this.domiciliosService.obtenerMisPedidos(id_usuario);
  }

  /**
   * Obtiene la información detallada de un domicilio por ID.
   *
   * @param id Identificador numérico del pedido.
   * @param usuario Usuario autenticado (validación de propiedad si es cliente).
   * @returns Detalle del domicilio y su comanda.
   */
  @ApiOperation({
    summary: 'Obtener pedido a domicilio por ID',
    description:
      'Consulta el detalle de entrega, repartidor asignado e ítems de un pedido a domicilio. Aplica protección anti-IDOR: si quien consulta tiene rol `cliente`, solo permite ver pedidos de su propiedad.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`, `cliente` (solo propios).',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido a domicilio', example: 10 })
  @ApiResponse({ status: 200, description: 'Detalle del pedido obtenido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: no puedes consultar pedidos de otro cliente.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Get(':id')
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cliente,
  )
  obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario?: any,
  ) {
    return this.domiciliosService.obtenerPorId(id, usuario);
  }

  /**
   * Actualiza la etapa operativa de un domicilio (ej. 'En Reparto', 'Entregado').
   *
   * @param id Identificador del pedido.
   * @param dto Nuevo estado y datos de repartidor.
   * @param id_usuario Colaborador que realiza la actualización.
   * @returns Domicilio con estado actualizado.
   */
  @ApiOperation({
    summary: 'Actualizar etapa de entrega de domicilio',
    description:
      'Avanza el ciclo logístico del domicilio (p. ej. `En Preparación`, `En Reparto`, `Entregado`) y permite asociar los datos del repartidor encargado del despacho.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiBody({ type: CambiarEstadoDomicilioDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDomicilioDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.domiciliosService.cambiarEstado(id, dto, id_usuario);
  }

  /**
   * Cancela un pedido a domicilio y revierte el inventario de los productos.
   *
   * @param id Identificador del pedido.
   * @param dto Motivo formal de la cancelación.
   * @returns Pedido cancelado.
   */
  @ApiOperation({
    summary: 'Cancelar pedido a domicilio y revertir inventario',
    description:
      'Anula un pedido a domicilio registrando el motivo de cancelación y restituyendo automáticamente al inventario las unidades de productos que habían sido descontadas.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiResponse({ status: 200, description: 'Pedido cancelado e inventario revertido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Patch(':id/cancelar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: CancelarDomicilioDto | string,
  ) {
    const motivo = typeof dto === 'string' ? dto : dto?.motivo;
    return this.domiciliosService.cancelar(id, motivo);
  }

  /**
   * Edita los datos de un domicilio desde el historial.
   *
   * @param id Identificador del pedido.
   * @param dto Datos a actualizar.
   * @returns Domicilio actualizado.
   */
  @ApiOperation({
    summary: 'Actualizar datos de domicilio',
    description:
      'Modifica información de entrega de un pedido a domicilio (dirección, barrio, teléfono, observaciones o valor de envío).\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiBody({ type: UpdateDomicilioDto })
  @ApiResponse({ status: 200, description: 'Domicilio actualizado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Patch(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDomicilioDto,
  ) {
    return this.domiciliosService.actualizarDomicilio(id, dto);
  }

  /**
   * Limpia todos los pedidos a domicilio entregados y cancelados del historial.
   * Exclusivo para Super Administrador.
   *
   * @returns Conteo de registros archivados/eliminados.
   */
  @ApiOperation({
    summary: 'Limpiar historial de domicilios cerrados (Solo Administrador)',
    description:
      'Depura del tablero de domicilios los registros históricos ya entregados o cancelados.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Historial depurado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @Delete('historial')
  @Roles(RolUsuario.administrador)
  limpiarHistorial() {
    return this.domiciliosService.limpiarHistorial();
  }

  /**
   * Elimina un pedido cerrado o cancelado específico del historial.
   * Exclusivo para Super Administrador.
   *
   * @param id Identificador del pedido.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({
    summary: 'Eliminar domicilio del historial (Solo Administrador)',
    description:
      'Elimina un pedido a domicilio específico ya finalizado o cancelado del historial del sistema.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiResponse({ status: 200, description: 'Domicilio eliminado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.domiciliosService.eliminar(id);
  }
}
