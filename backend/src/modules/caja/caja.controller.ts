import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CajaService } from './caja.service';
import { AbrirCajaDto, CerrarCajaDto, CreateGastoDto } from './dto';

@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  /**
   * POST /api/v1/caja/abrir
   * Inicia un nuevo turno de caja con base inicial.
   */
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
   * GET /api/v1/caja/estado
   * Obtiene el estado de la caja activa, métricas en vivo, desglose y movimientos.
   */
  @Get('estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerEstado() {
    return this.cajaService.obtenerEstadoActual();
  }

  /**
   * POST /api/v1/caja/gastos
   * Registra un gasto o egreso menor de dinero en la caja activa.
   */
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
   * POST /api/v1/caja/cerrar
   * Realiza el arqueo físico y cierra el turno de caja calculando diferencias.
   */
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
   * GET /api/v1/caja/historial
   * Consulta el histórico de turnos anteriores cerrados.
   */
  @Get('historial')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerHistorial(@Query('limite') limite?: string) {
    const lim = limite ? parseInt(limite, 10) : 15;
    return this.cajaService.obtenerHistorial(lim);
  }
}
