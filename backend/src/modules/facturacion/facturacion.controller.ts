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
import { CreateFacturaDto, UpdateFacturaDto } from './dto';
import { FacturacionService } from './facturacion.service';

@Controller('facturas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  /**
   * POST /api/v1/facturas
   * Registra el cobro y facturación, asocia a la caja activa.
   */
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
   * GET /api/v1/facturas
   * Consulta el historial general de facturas con filtros.
   */
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodas(
    @Query('tipo') tipo?: string,
    @Query('fecha') fecha?: string,
    @Query('buscar') buscar?: string,
    @Query('id_caja') id_caja?: number,
  ) {
    return this.facturacionService.obtenerTodas({ tipo, fecha, buscar, id_caja });
  }

  /**
   * GET /api/v1/facturas/:id
   * Consulta una factura por su ID.
   */
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.facturacionService.obtenerPorId(id);
  }

  /**
   * PATCH /api/v1/facturas/:id
   * Edita una factura existente (pagos, método de pago, propina, observaciones).
   */
  @Patch(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFacturaDto,
  ) {
    return this.facturacionService.actualizarFactura(id, dto);
  }
}

