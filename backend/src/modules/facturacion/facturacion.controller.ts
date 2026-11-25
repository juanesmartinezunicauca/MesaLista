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
import { AnularFacturaDto, CreateFacturaDto, UpdateFacturaDto } from './dto';
import { FacturacionService } from './facturacion.service';

/**
 * Controlador de Facturación, Cobro y Control de Medios de Pago
 * Gestiona el cierre contable de cuentas de salón y pedidos a domicilio vinculados a la caja activa.
 */
@ApiTags('Facturación')
@ApiBearerAuth('JWT-auth')
@Controller('facturas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  /**
   * Registra el cobro y emisión de factura, vinculando los ingresos al turno de caja activo.
   *
   * @param createFacturaDto Datos de pago, propina, mesa o pedido y cliente.
   * @param id_usuario Identificador del cajero o colaborador que cobra.
   * @returns Factura emitida con consecutivos y pagos registrados.
   */
  @ApiOperation({
    summary: 'Emitir factura y registrar pagos en caja',
    description:
      'Procesa el cobro atómico de una cuenta de salón (por mesa) o de un pedido a domicilio, exige que exista un turno de caja abierto, calcula total + propina voluntaria, registra uno o varios medios de pago, cierra las comandas asociadas y libera la mesa si aplica.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiBody({ type: CreateFacturaDto })
  @ApiResponse({ status: 201, description: 'Factura emitida y registrada en caja exitosamente.' })
  @ApiResponse({ status: 400, description: 'No hay turno de caja abierto o montos de pago no cuadran con el total.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  crear(
    @Body() createFacturaDto: CreateFacturaDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.facturacionService.crearFactura(createFacturaDto, id_usuario);
  }

  /**
   * Consulta el historial de facturas emitidas con filtros por fecha, tipo o caja.
   *
   * @param tipo Filtro por canal (salón o domicilio).
   * @param fecha Fecha YYYY-MM-DD.
   * @param buscar Búsqueda por cliente o consecutivo.
   * @param id_caja ID del turno de caja específico.
   * @returns Lista de facturas emitidas y anuladas.
   */
  @ApiOperation({
    summary: 'Listar historial de facturas con filtros',
    description:
      'Consulta las facturas emitidas y anuladas con filtros opcionales por canal (`salon`/`domicilio`), `fecha`, búsqueda por cliente/consecutivo (`buscar`) o turno de caja (`id_caja`), incluyendo desglose de medios de pago.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiQuery({ name: 'tipo', required: false, description: 'Canal de venta (salon o domicilio)' })
  @ApiQuery({ name: 'estado', required: false, description: 'Estado de factura (emitida o anulada)' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha exacta YYYY-MM-DD' })
  @ApiQuery({ name: 'fecha_inicio', required: false, description: 'Fecha inicial del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_fin', required: false, description: 'Fecha final del rango (YYYY-MM-DD)' })
  @ApiQuery({ name: 'buscar', required: false, description: 'Nombre de cliente o número' })
  @ApiQuery({ name: 'id_caja', required: false, description: 'ID de turno de caja' })
  @ApiResponse({ status: 200, description: 'Historial de facturas obtenido exitosamente.' })
  @ApiResponse({ status: 400, description: 'Parámetros de fecha o id_caja inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodas(
    @Query('tipo') tipo?: string,
    @Query('fecha') fecha?: string,
    @Query('buscar') buscar?: string,
    @Query('id_caja') id_caja?: number,
    @Query('fecha_inicio') fecha_inicio?: string,
    @Query('fecha_fin') fecha_fin?: string,
    @Query('estado') estado?: string,
  ) {
    return this.facturacionService.obtenerTodas({
      tipo,
      fecha,
      buscar,
      id_caja,
      ...(estado ? { estado } : {}),
      ...(fecha_inicio ? { fecha_inicio } : {}),
      ...(fecha_fin ? { fecha_fin } : {}),
    });
  }

  /**
   * Consulta una factura por su ID.
   *
   * @param id Identificador de la venta.
   * @returns Ficha completa de la factura con pagos e ítems.
   */
  @ApiOperation({
    summary: 'Obtener factura por ID',
    description:
      'Recupera el comprobante detallado de una venta por su identificador numérico, incluyendo pagos discriminados, propina, ítems facturados e información de anulación si existiera.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`, `mesero`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiResponse({ status: 200, description: 'Factura encontrada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.facturacionService.obtenerPorId(id);
  }

  /**
   * Modifica una factura existente (ajuste de propina, medios de pago u observaciones).
   *
   * @param id Identificador de la factura.
   * @param dto Datos a actualizar.
   * @param usuarioAuth Usuario en sesión.
   * @returns Factura actualizada.
   */
  @ApiOperation({
    summary: 'Actualizar datos de factura emitida',
    description:
      'Permite corregir o actualizar datos administrativos de una factura emitida (por ejemplo propina, distribución de medios de pago u observaciones) manteniendo consistencia contable en caja.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiBody({ type: UpdateFacturaDto })
  @ApiResponse({ status: 200, description: 'Factura actualizada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o factura anulada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  @Patch(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFacturaDto,
    @CurrentUser() usuarioAuth?: any,
  ) {
    return this.facturacionService.actualizarFactura(id, dto, usuarioAuth);
  }

  /**
   * Anula formalmente una factura registrada por error de cobro, devolución o ajuste.
   * Preserva el consecutivo de auditoría y descuenta su valor del arqueo de caja.
   *
   * @param id Identificador de la factura.
   * @param dto Motivo obligatorio de la anulación.
   * @param id_usuario Colaborador que anula la factura.
   * @returns Factura anulada con fecha y motivo.
   */
  @ApiOperation({
    summary: 'Anular factura formalmente',
    description:
      'Anula contablemente una factura exigiendo motivo de auditoría, conserva el consecutivo original, descuenta el ingreso en el arqueo de la caja correspondiente y registra fecha/usuario responsable.\n\n' +
      '**Roles autorizados:** `administrador`, `cajero`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura a anular', example: 1 })
  @ApiBody({ type: AnularFacturaDto })
  @ApiResponse({ status: 200, description: 'Factura anulada correctamente.' })
  @ApiResponse({ status: 400, description: 'La factura ya se encuentra anulada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  @Patch(':id/anular')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularFacturaDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.facturacionService.anularFactura(id, dto.motivo, id_usuario);
  }

  /**
   * Elimina o anula una factura registrada y restituye el saldo en el turno de caja.
   *
   * @param id Identificador de la factura.
   * @param id_usuario Colaborador administrador.
   * @returns Confirmación de anulación.
   */
  @ApiOperation({
    summary: 'Eliminar o anular factura desde terminal (Solo Administrador)',
    description:
      'Anula directamente una factura desde administración manteniendo la trazabilidad contable (soft-void) con motivo automático de terminal y reversión del saldo en el turno de caja.\n\n' +
      '**Roles autorizados:** `administrador`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiResponse({ status: 200, description: 'Factura procesada correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: requiere rol administrador.' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.facturacionService.anularFactura(
      id,
      'Anulación solicitada por terminal de cobro',
      id_usuario,
    );
  }
}
