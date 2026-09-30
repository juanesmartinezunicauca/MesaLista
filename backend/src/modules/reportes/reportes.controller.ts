import {
  Controller,
  Get,
  Header,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { QueryReporteDto } from './dto';
import { ReportesService } from './reportes.service';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /**
   * GET /api/v1/reportes/resumen
   * Consulta el consolidado analítico de ventas, utilidades, medios de pago y top productos.
   * Exclusivo para administradores.
   */
  @Get('resumen')
  @Roles(RolUsuario.administrador)
  obtenerResumen(@Query() query: QueryReporteDto) {
    return this.reportesService.obtenerResumenEjecutivo(query);
  }

  /**
   * GET /api/v1/reportes/turnos-caja
   * Historial de auditoría de los últimos turnos de caja con diferencias y arqueos.
   */
  @Get('turnos-caja')
  @Roles(RolUsuario.administrador)
  obtenerHistorialTurnos(@Query('limite') limite?: string) {
    const lim = limite ? parseInt(limite, 10) : 15;
    return this.reportesService.obtenerHistorialTurnosCaja(lim);
  }

  /**
   * GET /api/v1/reportes/exportar-csv
   * Genera y descarga el archivo CSV con las métricas consolidadas.
   */
  @Get('exportar-csv')
  @Roles(RolUsuario.administrador)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportarCsv(
    @Query() query: QueryReporteDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const csvData = await this.reportesService.exportarReporteCsv(query);
    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_mesalista_${fecha}.csv"`,
    );
    return csvData;
  }
}
