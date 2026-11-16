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
  @ApiOperation({
    summary: 'Crear comanda de salón o pedido',
    description:
      'Registra una nueva comanda asociada a una mesa de salón o pedido general, congelando el precio unitario vigente del catálogo (para evitar alteración desde el cliente), descontando existencias si el producto controla inventario y marcando la mesa como `ocupada`.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiBody({ type: CreatePedidoDto })
  @ApiResponse({ status: 201, description: 'Comanda creada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Mesa inexistente, ocupada o ítems sin existencias.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Listar pedidos con filtros de comandería',
    description:
      'Consulta la cola operativa de cocina (KDS) y el historial de comandas, filtrando opcionalmente por `estado`, `tipo` (`mesa`/`domicilio`), `id_mesa` o rango de fechas.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`, `cocina`.',
  })
  @ApiResponse({ status: 200, description: 'Listado de comandas obtenido exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Obtener comandas activas de una mesa',
    description:
      'Recupera todas las comandas activas en preparación (`enviada`) asociadas a una mesa del salón para mostrar el consumo acumulado o preparar su cobro.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiParam({ name: 'id_mesa', description: 'ID de la mesa', example: 1 })
  @ApiResponse({ status: 200, description: 'Comandas activas de la mesa obtenidas.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Obtener pedido por ID',
    description:
      'Retorna el detalle completo de una comanda por su identificador, incluyendo ítems solicitados, precios unitarios congelados, mesa asignada y usuario que la registró.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`, `cocina`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Pedido encontrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Cambiar estado de comanda (KDS Cocina / Salón)',
    description:
      'Permite avanzar o cambiar el estado de preparación de una comanda desde la pantalla de cocina (KDS) o caja (`enviada`, `cerrada`, `cancelada`).\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `cocina`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiBody({ type: CambiarEstadoPedidoDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Cancelar comanda activa',
    description:
      'Anula una comanda en curso pasándola a estado `cancelada`, restituye automáticamente al inventario las cantidades descontadas de sus ítems y libera la mesa si no quedan otras comandas activas.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Comanda cancelada y stock restaurado.' })
  @ApiResponse({ status: 400, description: 'La comanda ya está cerrada o cancelada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
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
  @ApiOperation({
    summary: 'Actualizar comanda',
    description:
      'Actualiza notas, observaciones u otros atributos editables de una comanda existente en el historial operativo.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiBody({ type: UpdatePedidoDto })
  @ApiResponse({ status: 200, description: 'Comanda actualizada exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
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
  @ApiOperation({
    summary: 'Eliminar pedido histórico (Solo Administrador)',
    description:
      'Elimina definitivamente un registro de pedido del historial del sistema. Operación administrativa restringida.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 1 })
  @ApiResponse({ status: 200, description: 'Pedido eliminado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.eliminar(id);
  }
}
