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
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoPedidoDto,
  CreatePedidoDto,
  QueryPedidoDto,
  UpdatePedidoDto,
} from './dto';
import { PedidosService } from './pedidos.service';

/**
 * Controlador de Comandería y Cocina (KDS)
 * Gestiona el ciclo de vida de comandas en salón, cola de preparación y congelamiento de precios.
 */
@ApiTags('Pedidos')
@ApiBearerAuth('JWT-auth')
@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  /**
   * Registra una nueva comanda de restaurante.
   * Congela el precio histórico de los ítems y valida existencias de inventario.
   *
   * @param createPedidoDto Datos de la comanda (tipo, mesa, lista de ítems).
   * @param id_usuario Identificador del colaborador que toma el pedido.
   * @returns Comanda creada con número de orden consecutivo.
   */
  @ApiOperation({ summary: 'Crear comanda de salón o pedido' })
  @ApiBody({ type: CreatePedidoDto })
  @ApiResponse({ status: 201, description: 'Comanda creada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Mesa inexistente, ocupada o ítems sin existencias.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  crear(
    @Body() createPedidoDto: CreatePedidoDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.pedidosService.crear(createPedidoDto, id_usuario);
  }

  /**
   * Consulta el histórico y cola de pedidos con filtros opcionales.
   *
   * @param query Filtros por estado, tipo, mesa o fecha.
   * @returns Lista de pedidos con sus ítems detallados.
   */
  @ApiOperation({ summary: 'Listar pedidos con filtros de comandería' })
  @ApiResponse({ status: 200, description: 'Listado de comandas obtenido exitosamente.' })
  @Get()
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cocina,
  )
  obtenerTodos(@Query() query: QueryPedidoDto) {
    return this.pedidosService.obtenerTodos(query);
  }

  /**
   * Obtiene las comandas activas pendientes de una mesa específica.
   *
   * @param id_mesa Identificador de la mesa.
   * @returns Lista de pedidos en estado 'enviada'.
   */
  @ApiOperation({ summary: 'Obtener comandas activas de una mesa' })
  @ApiParam({ name: 'id_mesa', description: 'ID de la mesa', example: 1 })
  @ApiResponse({ status: 200, description: 'Comandas activas de la mesa obtenidas.' })
  @Get('mesa/:id_mesa')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorMesa(@Param('id_mesa', ParseIntPipe) id_mesa: number) {
    return this.pedidosService.obtenerPorMesa(id_mesa);
  }

  /**
   * Consulta el detalle completo de un pedido por su ID.
   *
   * @param id Identificador numérico de la comanda.
   * @returns Detalle del pedido con ítems, mesa y usuario creador.
   */
  @ApiOperation({ summary: 'Obtener pedido por ID' })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Pedido encontrado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Get(':id')
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cocina,
  )
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.obtenerPorId(id);
  }

  /**
   * Actualiza el estado de preparación de un pedido (enviada, cerrada, cancelada).
   *
   * @param id Identificador de la comanda.
   * @param cambiarEstadoDto Nuevo estado operativo.
   * @returns Comanda con estado actualizado.
   */
  @ApiOperation({ summary: 'Cambiar estado de comanda (KDS Cocina / Salón)' })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiBody({ type: CambiarEstadoPedidoDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.cocina)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoPedidoDto,
  ) {
    return this.pedidosService.cambiarEstado(id, cambiarEstadoDto);
  }

  /**
   * Cancela una comanda activa y restituye existencias al inventario.
   *
   * @param id Identificador del pedido.
   * @returns Comanda cancelada.
   */
  @ApiOperation({ summary: 'Cancelar comanda activa' })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Comanda cancelada y stock restaurado.' })
  @Patch(':id/cancelar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.cancelar(id);
  }

  /**
   * Edita las observaciones o propiedades de un pedido desde el historial.
   *
   * @param id Identificador del pedido.
   * @param dto Datos a actualizar.
   * @returns Pedido actualizado.
   */
  @ApiOperation({ summary: 'Actualizar comanda' })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiBody({ type: UpdatePedidoDto })
  @ApiResponse({ status: 200, description: 'Comanda actualizada exitosamente.' })
  @Patch(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePedidoDto,
  ) {
    return this.pedidosService.actualizar(id, dto);
  }

  /**
   * Elimina un pedido histórico. Exclusivo para Super Administrador.
   *
   * @param id Identificador del pedido.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({ summary: 'Eliminar pedido histórico (Solo Administrador)' })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Pedido eliminado correctamente.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.eliminar(id);
  }
}
