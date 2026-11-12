import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  FiltroFechasDto,
  FiltroGastosDto,
  FiltroInventarioDto,
  FiltroOperacionDto,
  FiltroVentasDto,
} from './dto';
import { ReportesService } from './reportes.service';

/**
 * Controlador de Reportes Analíticos y Business Intelligence (BI)
 * Métricas consolidadas financieras, operativas, de inventario y caja. Exclusivo para Administrador.
 */
@ApiTags('Reportes')
@ApiBearerAuth('JWT-auth')
@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.administrador)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /**
   * KPIs ejecutivos consolidados, gráficos de resumen de ventas y comparativa con el periodo anterior.
   *
   * @param filtro Rango de fechas (fecha_inicio, fecha_fin).
   * @returns Resumen ejecutivo de ventas, órdenes, ticket promedio y márgenes.
   */
  @ApiOperation({
    summary: 'Dashboard ejecutivo consolidado de métricas (KPIs)',
    description: 'Calcula ingresos brutos, ticket promedio, comparativa porcentual y gráficos de tendencia temporal.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard analítico calculado exitosamente.' })
  @Get('dashboard')
  obtenerDashboard(@Query() filtro: FiltroFechasDto) {
    return this.reportesService.obtenerDashboard(filtro);
  }

  /**
   * Reporte detallado de ventas por producto, categorías, canales de servicio y facturas.
   *
   * @param filtro Filtros por rango de fechas, categoría, tipo de servicio o mesa.
   * @returns Desglose analítico de ventas y recaudación.
   */
  @ApiOperation({ summary: 'Reporte detallado de ventas y recaudación' })
  @ApiResponse({ status: 200, description: 'Reporte de ventas generado.' })
  @Get('ventas')
  obtenerReporteVentas(@Query() filtro: FiltroVentasDto) {
    return this.reportesService.obtenerReporteVentas(filtro);
  }

  /**
   * Reporte contable de turnos de caja, ingresos/egresos por medio de pago y descuadres de arqueo.
   *
   * @param filtro Rango de fechas del periodo a auditar.
   * @returns Cuadre consolidado de caja y arqueos ciegos.
   */
  @ApiOperation({ summary: 'Reporte contable de caja y conciliación por medio de pago' })
  @ApiResponse({ status: 200, description: 'Conciliación de turnos y medios de pago generada.' })
  @Get('caja-medios')
  obtenerReporteCajaMedios(@Query() filtro: FiltroFechasDto) {
    return this.reportesService.obtenerReporteCajaMedios(filtro);
  }

  /**
   * Reporte de existencias, productos con bajo stock, agotados y valorización de inventario.
   *
   * @param filtro Filtros de categoría, bajo stock y agotados.
   * @returns Ficha valorizada de existencias físicas y alertas.
   */
  @ApiOperation({ summary: 'Reporte de valorización y alertas de inventario' })
  @ApiResponse({ status: 200, description: 'Reporte de inventario generado.' })
  @Get('inventario')
  obtenerReporteInventario(@Query() filtro: FiltroInventarioDto) {
    return this.reportesService.obtenerReporteInventario(filtro);
  }

  /**
   * Reporte de salidas de dinero, desglose por tipo de egreso y medio de pago.
   *
   * @param filtro Rango de fechas, tipo de gasto y medio de pago.
   * @returns Historial y totalización de egresos operativos.
   */
  @ApiOperation({ summary: 'Reporte de gastos operativos y salidas de caja' })
  @ApiResponse({ status: 200, description: 'Reporte de gastos generado.' })
  @Get('gastos')
  obtenerReporteGastos(@Query() filtro: FiltroGastosDto) {
    return this.reportesService.obtenerReporteGastos(filtro);
  }

  /**
   * Reporte de ingresos, costo estimado y margen de contribución bruto por producto.
   *
   * @param filtro Rango de fechas y categoría opcional.
   * @returns Rentabilidad y márgenes de ganancia por plato.
   */
  @ApiOperation({ summary: 'Reporte de rentabilidad y margen bruto de contribución' })
  @ApiQuery({ name: 'categoria', required: false, description: 'Filtrar por categoría de plato' })
  @ApiResponse({ status: 200, description: 'Análisis de rentabilidad generado.' })
  @Get('rentabilidad')
  obtenerReporteRentabilidad(
    @Query() filtro: FiltroFechasDto & { categoria?: string },
  ) {
    return this.reportesService.obtenerReporteRentabilidad(filtro);
  }

  /**
   * Estadísticas de comandería, cancelaciones, tiempos y horas pico de atención.
   *
   * @param filtro Rango de fechas, tipo de servicio y estado.
   * @returns Métricas operativas de volumen y tiempos.
   */
  @ApiOperation({ summary: 'Reporte de rendimiento operativo y horas pico' })
  @ApiResponse({ status: 200, description: 'Estadísticas de operación generadas.' })
  @Get('operacion')
  obtenerReporteOperacion(@Query() filtro: FiltroOperacionDto) {
    return this.reportesService.obtenerReporteOperacion(filtro);
  }
}
