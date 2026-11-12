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
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CajaService } from './caja.service';
import {
  AbrirCajaDto,
  ActualizarBaseDto,
  CerrarCajaDto,
  CreateGastoDto,
  UpdateGastoDto,
} from './dto';

/**
 * Controlador de Turnos de Caja, Arqueo Físico y Gastos Menores
 * Controla el ciclo de vida de turnos de caja, balance teórico vs real y control de egresos.
 */
@ApiTags('Caja')
@ApiBearerAuth('JWT-auth')
@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  /**
   * Inicia un nuevo turno de caja con fondo base en efectivo.
   *
   * @param abrirCajaDto Monto base inicial.
   * @param id_usuario Cajero o administrador que realiza la apertura.
   * @returns Turno de caja creado en estado 'abierta'.
   */
  @ApiOperation({ summary: 'Apertura de turno de caja' })
  @ApiBody({ type: AbrirCajaDto })
  @ApiResponse({ status: 201, description: 'Turno de caja abierto exitosamente.' })
  @ApiResponse({ status: 400, description: 'Ya existe un turno de caja abierto actualmente.' })
  @Post('abrir')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  abrir(
    @Body() abrirCajaDto: AbrirCajaDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.cajaService.abrirCaja(abrirCajaDto, id_usuario);
  }

  /**
   * Actualiza el valor base inicial de la caja activa.
   *
   * @param dto Nuevo valor base.
   * @returns Caja con base actualizada.
   */
  @ApiOperation({ summary: 'Actualizar base inicial de la caja activa' })
  @ApiBody({ type: ActualizarBaseDto })
  @ApiResponse({ status: 200, description: 'Base actualizada exitosamente.' })
  @Patch('base')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizarBase(@Body() dto: ActualizarBaseDto) {
    return this.cajaService.actualizarBaseCaja(dto.valor_inicial);
  }

  /**
   * Consulta el estado de la caja activa con balance teórico en vivo y desglose de pagos y gastos.
   *
   * @returns Balance en tiempo real de la caja abierta.
   */
  @ApiOperation({ summary: 'Consultar estado y balance en vivo de caja activa' })
  @ApiResponse({ status: 200, description: 'Estado actual y métricas de caja obtenidos.' })
  @ApiResponse({ status: 404, description: 'No hay turno de caja abierto actualmente.' })
  @Get('estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerEstado() {
    return this.cajaService.obtenerEstadoActual();
  }

  /**
   * Registra un gasto o egreso menor de dinero de la caja activa.
   *
   * @param createGastoDto Concepto, total, tipo y medio de pago del gasto.
   * @param id_usuario Cajero responsable de la salida de dinero.
   * @returns Asiento de gasto registrado.
   */
  @ApiOperation({ summary: 'Registrar gasto o egreso menor de caja' })
  @ApiBody({ type: CreateGastoDto })
  @ApiResponse({ status: 201, description: 'Gasto registrado correctamente en el turno.' })
  @ApiResponse({ status: 400, description: 'No hay caja abierta o fondos insuficientes.' })
  @Post('gastos')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  registrarGasto(
    @Body() createGastoDto: CreateGastoDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.cajaService.registrarGasto(createGastoDto, id_usuario);
  }

  /**
   * Consulta el histórico de gastos registrados en caja.
   *
   * @param limite Cantidad máxima de registros a retornar (por defecto 50).
   * @returns Lista de gastos registrados.
   */
  @ApiOperation({ summary: 'Listar gastos registrados en caja' })
  @ApiQuery({ name: 'limite', required: false, description: 'Límite de registros (default 50)' })
  @ApiResponse({ status: 200, description: 'Historial de gastos obtenido.' })
  @Get('gastos')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerGastos(@Query('limite') limite?: string) {
    const lim = limite ? parseInt(limite, 10) : 50;
    return this.cajaService.obtenerGastos(lim);
  }

  /**
   * Actualiza los datos de un gasto registrado.
   *
   * @param id Identificador del gasto.
   * @param dto Modificación de monto, concepto o tipo.
   * @param usuarioAuth Usuario autenticado.
   * @returns Gasto actualizado.
   */
  @ApiOperation({ summary: 'Actualizar gasto registrado' })
  @ApiParam({ name: 'id', description: 'ID del gasto', example: 1 })
  @ApiBody({ type: UpdateGastoDto })
  @ApiResponse({ status: 200, description: 'Gasto actualizado.' })
  @Patch('gastos/:id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizarGasto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGastoDto,
    @CurrentUser() usuarioAuth?: any,
  ) {
    return this.cajaService.actualizarGasto(id, dto, usuarioAuth);
  }

  /**
   * Elimina un gasto del sistema. Exclusivo para Super Administrador.
   *
   * @param id Identificador del gasto.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({ summary: 'Eliminar gasto (Solo Administrador)' })
  @ApiParam({ name: 'id', description: 'ID del gasto a eliminar', example: 1 })
  @ApiResponse({ status: 200, description: 'Gasto eliminado.' })
  @Delete('gastos/:id')
  @Roles(RolUsuario.administrador)
  eliminarGasto(@Param('id', ParseIntPipe) id: number) {
    return this.cajaService.eliminarGasto(id);
  }

  /**
   * Ejecuta el arqueo físico ciego y cierra el turno de caja calculando diferencias.
   *
   * @param cerrarCajaDto Conteo físico reportado y observaciones.
   * @param id_usuario Cajero o administrador que realiza el cierre.
   * @returns Resumen consolidado del turno cerrado con sobrantes/faltantes.
   */
  @ApiOperation({
    summary: 'Cierre de turno de caja (Arqueo ciego)',
    description: 'Compara el valor físico reportado con el teórico calculado por el sistema y sella el turno.',
  })
  @ApiBody({ type: CerrarCajaDto })
  @ApiResponse({ status: 200, description: 'Turno de caja cerrado exitosamente con balance de arqueo.' })
  @ApiResponse({ status: 400, description: 'No hay turno abierto o existen mesas con comandas activas pendientes.' })
  @Post('cerrar')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cerrar(
    @Body() cerrarCajaDto: CerrarCajaDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.cajaService.cerrarCaja(cerrarCajaDto, id_usuario);
  }

  /**
   * Consulta el histórico de turnos anteriores cerrados.
   *
   * @param limite Cantidad máxima de turnos a retornar (por defecto 15).
   * @returns Lista de turnos cerrados con totales y diferencias.
   */
  @ApiOperation({ summary: 'Consultar historial de turnos de caja cerrados' })
  @ApiQuery({ name: 'limite', required: false, description: 'Límite de turnos a listar (default 15)' })
  @ApiResponse({ status: 200, description: 'Historial de turnos obtenido.' })
  @Get('historial')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerHistorial(@Query('limite') limite?: string) {
    const lim = limite ? parseInt(limite, 10) : 15;
    return this.cajaService.obtenerHistorial(lim);
  }

  /**
   * Edita la observación de un turno cerrado de caja. Exclusivo para Super Administrador.
   *
   * @param id Identificador de la caja cerrada.
   * @param observacion Nueva nota u observación de auditoría.
   * @returns Turno con nota actualizada.
   */
  @ApiOperation({ summary: 'Actualizar observación de turno cerrado (Solo Administrador)' })
  @ApiParam({ name: 'id', description: 'ID del turno de caja', example: 1 })
  @ApiResponse({ status: 200, description: 'Observación actualizada.' })
  @Patch('historial/:id')
  @Roles(RolUsuario.administrador)
  actualizarObservacion(
    @Param('id', ParseIntPipe) id: number,
    @Body('observacion') observacion: string,
  ) {
    return this.cajaService.actualizarObservacionTurno(id, observacion);
  }

  /**
   * Reinicia los datos operativos preservando catálogo y usuarios. Exclusivo para administradores.
   *
   * @returns Confirmación del reinicio operativo.
   */
  @ApiOperation({ summary: 'Reinicio de datos operativos (Solo Administrador)' })
  @ApiResponse({ status: 200, description: 'Datos operativos reiniciados.' })
  @Post('reset-operacional')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador)
  resetOperacional() {
    return this.cajaService.resetOperacional();
  }
}
