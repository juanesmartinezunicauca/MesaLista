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
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoDomicilioDto,
  CambiarRecepcionDomiciliosDto,
  CancelarDomicilioDto,
  CreateDomicilioDto,
} from './dto';
import { DomiciliosService } from './domicilios.service';

@Controller('domicilios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomiciliosController {
  constructor(private readonly domiciliosService: DomiciliosService) {}

  /**
   * GET /api/v1/domicilios/estado-servicio
   * Consulta pública del estado de atención y recepción de domicilios.
   */
  @Get('estado-servicio')
  @Public()
  obtenerEstadoServicio() {
    return this.domiciliosService.obtenerEstadoServicio();
  }

  /**
   * PATCH /api/v1/domicilios/estado-servicio
   * Permite al cajero/administrador activar o pausar la recepción de domicilios.
   */
  @Patch('estado-servicio')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cambiarRecepcionDomicilios(@Body() dto: CambiarRecepcionDomiciliosDto) {
    return this.domiciliosService.cambiarRecepcionDomicilios(dto.recibiendo, dto.motivo);
  }

  /**
   * POST /api/v1/domicilios
   * Registra un nuevo pedido a domicilio con cliente, productos y congelamiento de precios.
   */
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
   * GET /api/v1/domicilios/clientes/buscar
   * Busca clientes registrados por teléfono o nombre para autocompletar en el formulario.
   */
  @Get('clientes/buscar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  buscarClientes(@Query('query') query?: string) {
    return this.domiciliosService.buscarClientes(query || '');
  }

  /**
   * GET /api/v1/domicilios
   * Lista todos los pedidos a domicilio con filtros opcionales de estado, fecha o búsqueda.
   */
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
   * GET /api/v1/domicilios/mis-pedidos
   * Consulta los pedidos del cliente autenticado.
   */
  @Get('mis-pedidos')
  @Roles(RolUsuario.cliente, RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerMisPedidos(@CurrentUser('id_usuario') id_usuario: number) {
    return this.domiciliosService.obtenerMisPedidos(id_usuario);
  }

  /**
   * GET /api/v1/domicilios/:id
   * Obtiene la información detallada de un pedido a domicilio por su identificador.
   */
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
   * PATCH /api/v1/domicilios/:id/estado
   * Actualiza la etapa operativa de un domicilio ('En Reparto', 'En Preparación', 'Cancelado').
   */
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
   * PATCH /api/v1/domicilios/:id/cancelar
   * Cancela el pedido a domicilio y revierte el inventario de los productos.
   */
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
   * DELETE /api/v1/domicilios/historial
   * Limpia todos los pedidos a domicilio entregados y cancelados del historial.
   * Totalmente seguro: no afecta mesas de salón, clientes ni facturación de caja.
   */
  @Delete('historial')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  limpiarHistorial() {
    return this.domiciliosService.limpiarHistorial();
  }

  /**
   * DELETE /api/v1/domicilios/:id
   * Elimina un pedido cerrado o cancelado específico del historial.
   */
  @Delete(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.domiciliosService.eliminar(id);
  }
}
