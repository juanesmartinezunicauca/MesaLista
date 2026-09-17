import {
  Body,
  Controller,
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
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoPedidoDto,
  CreatePedidoDto,
  QueryPedidoDto,
} from './dto';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  /**
   * POST /api/v1/pedidos
   * Registra una nueva comanda (salón o domicilio) con items y congelamiento de precio.
   */
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
   * GET /api/v1/pedidos
   * Consulta pedidos con filtros opcionales (estado, tipo, mesa, cliente, fecha).
   */
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
   * GET /api/v1/pedidos/mesa/:id_mesa
   * Consulta los pedidos activos ('enviada') de una mesa específica.
   */
  @Get('mesa/:id_mesa')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorMesa(@Param('id_mesa', ParseIntPipe) id_mesa: number) {
    return this.pedidosService.obtenerPorMesa(id_mesa);
  }

  /**
   * GET /api/v1/pedidos/:id
   * Consulta el detalle de un pedido por ID.
   */
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
   * PATCH /api/v1/pedidos/:id/estado
   * Cambia el estado de un pedido (enviada / cerrada / cancelada).
   */
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.cocina)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoPedidoDto,
  ) {
    return this.pedidosService.cambiarEstado(id, cambiarEstadoDto);
  }

  /**
   * PATCH /api/v1/pedidos/:id/cancelar
   * Anula una comanda activa.
   */
  @Patch(':id/cancelar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.cancelar(id);
  }
}
