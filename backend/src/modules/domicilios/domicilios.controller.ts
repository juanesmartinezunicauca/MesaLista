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
    description: 'Informa a la vista pública de clientes si el restaurante está recibiendo pedidos a domicilio.',
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
  @ApiOperation({ summary: 'Abrir o pausar recepción de domicilios' })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CambiarRecepcionDomiciliosDto })
  @ApiResponse({ status: 200, description: 'Recepción actualizada exitosamente.' })
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
  @ApiOperation({ summary: 'Listar repartidores del directorio' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Directorio de repartidores obtenido.' })
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
  @ApiOperation({ summary: 'Guardar o actualizar repartidor' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Repartidor guardado correctamente.' })
  @Post('repartidores')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  guardarRepartidor(
    @Body() body: { id?: string; nombre: string; telefono: string; vehiculo?: string; activo?: boolean },
  ) {
    return this.domiciliosService.guardarRepartidor(body);
  }

  /**
   * Elimina un repartidor del directorio.
   *
   * @param id Identificador del repartidor.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({ summary: 'Eliminar repartidor' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del repartidor', example: 'rep-1' })
  @ApiResponse({ status: 200, description: 'Repartidor eliminado.' })
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
  @ApiOperation({ summary: 'Crear pedido a domicilio' })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateDomicilioDto })
  @ApiResponse({ status: 201, description: 'Pedido a domicilio creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Servicio pausado, datos incompletos o stock insuficiente.' })
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
  @ApiOperation({ summary: 'Listar pedidos a domicilio con filtros' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'estado', required: false, description: 'Filtrar por estado operativo' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha YYYY-MM-DD' })
  @ApiQuery({ name: 'buscar', required: false, description: 'Búsqueda por nombre o teléfono de cliente' })
  @ApiResponse({ status: 200, description: 'Listado de domicilios obtenido.' })
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodos(
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.domiciliosService.obtenerTodos({ estado, fecha, buscar });
  }

  /**
   * Consulta los pedidos del cliente autenticado.
   *
   * @param id_usuario Identificador del cliente extraído del token JWT.
   * @returns Lista de pedidos realizados por el cliente.
   */
  @ApiOperation({ summary: 'Consultar mis pedidos a domicilio (Portal Cliente)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Historial personal de pedidos del cliente.' })
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
  @ApiOperation({ summary: 'Obtener pedido a domicilio por ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido a domicilio', example: 10 })
  @ApiResponse({ status: 200, description: 'Detalle del pedido obtenido.' })
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
  @ApiOperation({ summary: 'Actualizar etapa de entrega de domicilio' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiBody({ type: CambiarEstadoDomicilioDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
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
  @ApiOperation({ summary: 'Cancelar pedido a domicilio y revertir inventario' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiResponse({ status: 200, description: 'Pedido cancelado e inventario revertido.' })
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
  @ApiOperation({ summary: 'Actualizar datos de domicilio' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiBody({ type: UpdateDomicilioDto })
  @ApiResponse({ status: 200, description: 'Domicilio actualizado.' })
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
  @ApiOperation({ summary: 'Limpiar historial de domicilios cerrados (Solo Administrador)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Historial depurado exitosamente.' })
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
  @ApiOperation({ summary: 'Eliminar domicilio del historial (Solo Administrador)' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 10 })
  @ApiResponse({ status: 200, description: 'Domicilio eliminado.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.domiciliosService.eliminar(id);
  }
}
