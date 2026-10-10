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
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CajaService } from './caja.service';
import { AbrirCajaDto, ActualizarBaseDto, CerrarCajaDto, CreateGastoDto, UpdateGastoDto } from './dto';

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
   * PATCH /api/v1/caja/base
   * Actualiza el valor base inicial de la caja activa.
   */
  @Patch('base')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizarBase(@Body() dto: ActualizarBaseDto) {
    return this.cajaService.actualizarBaseCaja(dto.valor_inicial);
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
   * GET /api/v1/caja/gastos
   * Consulta el histórico de gastos registrados en caja.
   */
  @Get('gastos')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  obtenerGastos(@Query('limite') limite?: string) {
    const lim = limite ? parseInt(limite, 10) : 50;
    return this.cajaService.obtenerGastos(lim);
  }

  /**
   * PATCH /api/v1/caja/gastos/:id
   * Actualiza los datos de un gasto. Permitido para Cajero y Super Admin.
   */
  @Patch('gastos/:id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizarGasto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGastoDto,
  ) {
    return this.cajaService.actualizarGasto(id, dto);
  }

  /**
   * DELETE /api/v1/caja/gastos/:id
   * Elimina un gasto del sistema. Exclusivo para Super Administrador.
   */
  @Delete('gastos/:id')
  @Roles(RolUsuario.administrador)
  eliminarGasto(@Param('id', ParseIntPipe) id: number) {
    return this.cajaService.eliminarGasto(id);
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

  /**
   * PATCH /api/v1/caja/historial/:id
   * Edita la observación de un turno cerrado de caja. Exclusivo para Super Administrador.
   */
  @Patch('historial/:id')
  @Roles(RolUsuario.administrador)
  actualizarObservacion(
    @Param('id', ParseIntPipe) id: number,
    @Body('observacion') observacion: string,
  ) {
    return this.cajaService.actualizarObservacionTurno(id, observacion);
  }

  /**
   * POST /api/v1/caja/reset-operacional
   * Reinicia los datos operativos preservando catálogo y usuarios. Exclusivo para administradores.
   */
  @Post('reset-operacional')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador)
  resetOperacional() {
    return this.cajaService.resetOperacional();
  }
}
