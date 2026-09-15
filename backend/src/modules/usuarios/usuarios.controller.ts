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
  CambiarEstadoDto,
  CreateUsuarioDto,
  QueryUsuarioDto,
  UpdateUsuarioDto,
} from './dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.administrador)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * POST /api/v1/usuarios
   * Crea un nuevo usuario en el sistema.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.crear(createUsuarioDto);
  }

  /**
   * GET /api/v1/usuarios
   * Lista usuarios con filtros opcionales (rol, estado, buscar).
   */
  @Get()
  obtenerTodos(@Query() query: QueryUsuarioDto) {
    return this.usuariosService.obtenerTodos(query);
  }

  /**
   * GET /api/v1/usuarios/:id
   * Obtiene la información de un usuario por su ID.
   */
  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerPorId(id);
  }

  /**
   * PATCH /api/v1/usuarios/:id
   * Actualiza parcialmente un usuario.
   */
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.actualizar(id, updateDto);
  }

  /**
   * PATCH /api/v1/usuarios/:id/estado
   * Modifica el estado activo/inactivo del usuario.
   */
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoDto,
  ) {
    return this.usuariosService.cambiarEstado(id, cambiarEstadoDto.estado);
  }

  /**
   * DELETE /api/v1/usuarios/:id
   * Desactiva (soft-delete) o elimina físicamente el usuario si no tiene historial.
   */
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.eliminar(id);
  }
}
