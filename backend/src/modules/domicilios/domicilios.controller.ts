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
import {
  CambiarEstadoDomicilioDto,
  CreateDomicilioDto,
} from './dto';
import { DomiciliosService } from './domicilios.service';

@Controller('domicilios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomiciliosController {
  constructor(private readonly domiciliosService: DomiciliosService) {}

  /**
   * POST /api/v1/domicilios
   * Registra un nuevo pedido a domicilio con cliente, productos y congelamiento de precios.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  crear(
    @Body() createDto: CreateDomicilioDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.domiciliosService.crear(createDto, id_usuario);
  }

  /**
   * GET /api/v1/domicilios/clientes/buscar
   * Busca clientes registrados por teléfono o nombre para autocompletar en el formulario.
   */
  @Get('clientes/buscar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  buscarClientes(@Query('query') query?: string) {
    return this.domiciliosService.buscarClientes(query || '');
  }

  /**
   * GET /api/v1/domicilios
   * Lista todos los pedidos a domicilio con filtros opcionales de estado, fecha o búsqueda.
   */
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodos(
    @Query('estado') estado?: string,
    @Query('fecha') fecha?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.domiciliosService.obtenerTodos({ estado, fecha, buscar });
  }

  /**
   * GET /api/v1/domicilios/:id
   * Obtiene la información detallada de un pedido a domicilio por su identificador.
   */
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.domiciliosService.obtenerPorId(id);
  }

  /**
   * PATCH /api/v1/domicilios/:id/estado
   * Actualiza la etapa operativa de un domicilio ('En Reparto', 'En Preparación', 'Cancelado').
   */
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDomicilioDto,
  ) {
    return this.domiciliosService.cambiarEstado(id, dto);
  }

  /**
   * PATCH /api/v1/domicilios/:id/cancelar
   * Cancela el pedido a domicilio y revierte el inventario de los productos.
   */
  @Patch(':id/cancelar')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo?: string,
  ) {
    return this.domiciliosService.cancelar(id, motivo);
  }
}
