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
import { Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  CambiarEstadoMesaDto,
  CreateMesaDto,
  QueryMesaDto,
  TransferirMesaDto,
  UpdateMesaDto,
} from './dto';
import { MesasService } from './mesas.service';

@Controller('mesas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MesasController {
  constructor(private readonly mesasService: MesasService) { }

  /**
   * POST /api/v1/mesas
   * Crea una nueva mesa en el restaurante. Solo administradores.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador)
  crear(@Body() createMesaDto: CreateMesaDto) {
    return this.mesasService.crear(createMesaDto);
  }

  /**
   * POST /api/v1/mesas/transferir
   * Transfiere comandas activas de una mesa a otra.
   */
  @Post('transferir')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  transferir(@Body() transferirMesaDto: TransferirMesaDto) {
    return this.mesasService.transferirMesa(transferirMesaDto);
  }

  /**
   * GET /api/v1/mesas
   * Lista todas las mesas con filtros opcionales. Acceso para admin, cajero y mesero.
   */
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodas(@Query() query: QueryMesaDto) {
    return this.mesasService.obtenerTodas(query);
  }

  /**
   * GET /api/v1/mesas/:id
   * Obtiene una mesa específica por ID con sus comandas activas.
   */
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.obtenerPorId(id);
  }

  /**
   * PATCH /api/v1/mesas/:id/estado
   * Actualiza el estado operativo de la mesa (libre / ocupada).
   */
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoMesaDto,
  ) {
    return this.mesasService.cambiarEstado(id, cambiarEstadoDto);
  }

  /**
   * PATCH /api/v1/mesas/:id
   * Actualiza número o propiedades estructurales de la mesa. Solo administradores.
   */
  @Patch(':id')
  @Roles(RolUsuario.administrador)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMesaDto: UpdateMesaDto,
  ) {
    return this.mesasService.actualizar(id, updateMesaDto);
  }

  /**
   * DELETE /api/v1/mesas/:id
   * Elimina una mesa físicamente si no tiene historial operativo. Solo administradores.
   */
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.eliminar(id);
  }
}
