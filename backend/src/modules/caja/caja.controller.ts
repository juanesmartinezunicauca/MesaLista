import {
  BadRequestException,
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

  private parseLimite(limite: string | undefined, defaultValue: number): number {
    if (limite === undefined || limite.trim() === '') {
      return defaultValue;
    }
    const trimmed = limite.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new BadRequestException('El parámetro limite debe ser un número entero entre 1 y 500.');
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 500) {
      throw new BadRequestException('El parámetro limite debe estar entre 1 y 500.');
    }
    return parsed;
  }

  /**
   * Inicia un nuevo turno de caja con fondo base en efectivo.
   *
   * @param abrirCajaDto Monto base inicial.
   * @param id_usuario Cajero o administrador que realiza la apertura.
   * @returns Turno de caja creado en estado 'abierta'.
   */
  @ApiOperation({
    summary: 'Apertura de turno de caja',
    description:
      'Inicia un nuevo turno de caja registrando el fondo base inicial en efectivo. Valida que no exista otra caja en estado `abierta` simultáneamente (requerido antes de poder facturar o registrar gastos).\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBody({ type: AbrirCajaDto })
  @ApiResponse({ status: 201, description: 'Turno de caja abierto exitosamente.' })
  @ApiResponse({ status: 400, description: 'Ya existe un turno de caja abierto actualmente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Actualizar base inicial de la caja activa',
    description:
      'Permite corregir o ajustar el fondo base en efectivo del turno de caja actualmente abierto y recalcula el balance teórico del turno.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBody({ type: ActualizarBaseDto })
  @ApiResponse({ status: 200, description: 'Base actualizada exitosamente.' })
  @ApiResponse({ status: 400, description: 'No hay caja abierta o valor inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Consultar estado y balance en vivo de caja activa',
    description:
      'Retorna el turno de caja abierto actualmente junto con el balance teórico en tiempo real, discriminando ingresos por medio de pago, propinas y egresos/gastos del turno.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiResponse({ status: 200, description: 'Estado actual y métricas de caja obtenidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Registrar gasto o egreso menor de caja',
    description:
      'Registra un egreso operativo (compra de insumos, servicio, proveedor u otro) vinculado al turno de caja abierto, descontándolo del saldo teórico según el medio de pago.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBody({ type: CreateGastoDto })
  @ApiResponse({ status: 201, description: 'Gasto registrado correctamente en el turno.' })
  @ApiResponse({ status: 400, description: 'No hay caja abierta o fondos insuficientes.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Listar gastos registrados en caja',
    description:
      'Obtiene la lista ordenada de gastos y egresos operativos registrados en los turnos de caja, con soporte para limitar la cantidad de resultados.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiQuery({ name: 'limite', required: false, description: 'Límite de registros (default 50, máx 500)' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Filtrar por día exacto (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_inicio', required: false, description: 'Fecha inicial del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_fin', required: false, description: 'Fecha final del rango (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Historial de gastos obtenido.' })
  @ApiResponse({ status: 400, description: 'Parámetros de límite o fecha inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Get('gastos')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerGastos(
    @Query('limite') limite?: string,
    @Query('fecha') fecha?: string,
    @Query('fecha_inicio') fecha_inicio?: string,
    @Query('fecha_fin') fecha_fin?: string,
  ) {
    const hayFiltroFecha = Boolean(fecha || fecha_inicio || fecha_fin);
    const lim = this.parseLimite(limite, hayFiltroFecha ? 200 : 50);
    if (!hayFiltroFecha) {
      return this.cajaService.obtenerGastos(lim);
    }
    return this.cajaService.obtenerGastos(lim, {
      ...(fecha ? { fecha } : {}),
      ...(fecha_inicio ? { fecha_inicio } : {}),
      ...(fecha_fin ? { fecha_fin } : {}),
    });
  }

  /**
   * Actualiza los datos de un gasto registrado.
   *
   * @param id Identificador del gasto.
   * @param dto Modificación de monto, concepto o tipo.
   * @param usuarioAuth Usuario autenticado.
   * @returns Gasto actualizado.
   */
  @ApiOperation({
    summary: 'Actualizar gasto registrado',
    description:
      'Permite corregir el concepto, categoría, monto o medio de pago de un egreso previamente registrado.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiParam({ name: 'id', description: 'ID del gasto', example: 1 })
  @ApiBody({ type: UpdateGastoDto })
  @ApiResponse({ status: 200, description: 'Gasto actualizado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Gasto no encontrado.' })
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
  @ApiOperation({
    summary: 'Eliminar gasto (Solo Administrador)',
    description:
      'Elimina un registro de gasto del turno contable, recalculando automáticamente los totales de egresos del turno.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID del gasto a eliminar', example: 1 })
  @ApiResponse({ status: 200, description: 'Gasto eliminado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Gasto no encontrado.' })
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
    description:
      'Ejecuta el arqueo ciego de cierre comparando el efectivo físico contado por el cajero contra el saldo teórico calculado por el sistema (base + ingresos en efectivo - gastos), registra sobrante/faltante y sella el turno como `cerrada`. Valida que no haya mesas ocupadas o comandas activas pendientes.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiBody({ type: CerrarCajaDto })
  @ApiResponse({ status: 200, description: 'Turno de caja cerrado exitosamente con balance de arqueo.' })
  @ApiResponse({ status: 400, description: 'No hay turno abierto o existen mesas con comandas activas pendientes.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
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
  @ApiOperation({
    summary: 'Consultar historial de turnos de caja cerrados',
    description:
      'Lista los arqueos y turnos cerrados anteriores ordenados cronológicamente con valores iniciales, cierres teóricos, conteos físicos, diferencias y observaciones.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiQuery({ name: 'limite', required: false, description: 'Límite de turnos a listar (default 15, máx 500)' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Filtrar por fecha de cierre (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_inicio', required: false, description: 'Fecha inicial del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_fin', required: false, description: 'Fecha final del rango (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Historial de turnos obtenido.' })
  @ApiResponse({ status: 400, description: 'Parámetros de límite o fecha inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Get('historial')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerHistorial(
    @Query('limite') limite?: string,
    @Query('fecha') fecha?: string,
    @Query('fecha_inicio') fecha_inicio?: string,
    @Query('fecha_fin') fecha_fin?: string,
  ) {
    const hayFiltroFecha = Boolean(fecha || fecha_inicio || fecha_fin);
    const lim = this.parseLimite(limite, hayFiltroFecha ? 200 : 15);
    if (!hayFiltroFecha) {
      return this.cajaService.obtenerHistorial(lim);
    }
    return this.cajaService.obtenerHistorial(lim, {
      ...(fecha ? { fecha } : {}),
      ...(fecha_inicio ? { fecha_inicio } : {}),
      ...(fecha_fin ? { fecha_fin } : {}),
    });
  }

  /**
   * Edita la observación de un turno cerrado de caja. Exclusivo para Super Administrador.
   *
   * @param id Identificador de la caja cerrada.
   * @param observacion Nueva nota u observación de auditoría.
   * @returns Turno con nota actualizada.
   */
  @ApiOperation({
    summary: 'Actualizar observación de turno cerrado (Solo Administrador)',
    description:
      'Agrega o edita la nota de auditoría sobre un turno de caja cerrado sin alterar sus cifras contables.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID del turno de caja', example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['observacion'],
      properties: {
        observacion: { type: 'string', example: 'Diferencia justificada por cambio pendiente de domicilio.' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Observación actualizada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Turno de caja no encontrado.' })
  @Patch('historial/:id')
  @Roles(RolUsuario.administrador)
  actualizarObservacion(
    @Param('id', ParseIntPipe) id: number,
    @Body('observacion') observacion: string,
  ) {
    if (observacion !== undefined && observacion !== null && typeof observacion !== 'string') {
      throw new BadRequestException('La observación debe ser una cadena de texto válida.');
    }
    return this.cajaService.actualizarObservacionTurno(id, observacion);
  }

  /**
   * Reinicia los datos operativos preservando catálogo y usuarios. Exclusivo para administradores.
   *
   * @returns Confirmación del reinicio operativo.
   */
  @ApiOperation({
    summary: 'Reinicio de datos operativos (Solo Administrador)',
    description:
      'Limpia transaccionalmente turnos de caja, facturas, pagos, gastos, comandas y domicilios (restableciendo mesas a estado `libre`), pero conserva intactos usuarios, catálogo de productos y configuración del restaurante.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiResponse({ status: 200, description: 'Datos operativos reiniciados.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @Post('reset-operacional')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador)
  resetOperacional() {
    return this.cajaService.resetOperacional();
  }
}
