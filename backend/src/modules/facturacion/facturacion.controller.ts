import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CreateFacturaDto } from './dto';
import { FacturacionService } from './facturacion.service';

@Controller('facturas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  /**
   * POST /api/v1/facturas
   * Registra el cobro y facturación de una mesa, asocia a la caja activa y libera la mesa.
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
   * GET /api/v1/facturas/:id
   * Consulta una factura por su ID.
   */
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.facturacionService.obtenerPorId(id);
  }
}
