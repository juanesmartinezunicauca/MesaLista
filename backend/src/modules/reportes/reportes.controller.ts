import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.administrador)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /**
   * GET /api/v1/reportes/dashboard
   * KPIs ejecutivos consolidados, gráficos resumen y comparativa con periodo anterior.
   */
  @Get('dashboard')
  obtenerDashboard(@Query() filtro: FiltroFechasDto) {
    return this.reportesService.obtenerDashboard(filtro);
  }

  /**
   * GET /api/v1/reportes/ventas
   * Reporte detallado de ventas, categorías, canales de servicio y facturas.
   */
  @Get('ventas')
  obtenerReporteVentas(@Query() filtro: FiltroVentasDto) {
    return this.reportesService.obtenerReporteVentas(filtro);
  }

  /**
   * GET /api/v1/reportes/caja-medios
   * Reporte contable de turnos de caja, ingresos/egresos por medio de pago y descuadres.
   */
  @Get('caja-medios')
  obtenerReporteCajaMedios(@Query() filtro: FiltroFechasDto) {
    return this.reportesService.obtenerReporteCajaMedios(filtro);
  }

  /**
   * GET /api/v1/reportes/inventario
   * Reporte de existencias, productos con bajo stock, agotados y valorización.
   */
  @Get('inventario')
  obtenerReporteInventario(@Query() filtro: FiltroInventarioDto) {
    return this.reportesService.obtenerReporteInventario(filtro);
  }

  /**
   * GET /api/v1/reportes/gastos
   * Reporte de salidas de dinero, desglose por tipo y medio de pago.
   */
  @Get('gastos')
  obtenerReporteGastos(@Query() filtro: FiltroGastosDto) {
    return this.reportesService.obtenerReporteGastos(filtro);
  }

  /**
   * GET /api/v1/reportes/rentabilidad
   * Reporte de ingresos, costo estimado y margen bruto por producto.
   */
  @Get('rentabilidad')
  obtenerReporteRentabilidad(
    @Query() filtro: FiltroFechasDto & { categoria?: string },
  ) {
    return this.reportesService.obtenerReporteRentabilidad(filtro);
  }

  /**
   * GET /api/v1/reportes/operacion
   * Estadísticas de comandas, cancelaciones y horas pico de atención.
   */
  @Get('operacion')
  obtenerReporteOperacion(@Query() filtro: FiltroOperacionDto) {
    return this.reportesService.obtenerReporteOperacion(filtro);
  }
}
