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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

/**
 * Controlador de Gestión de Mesas del Salón
 * Provee visualización en tiempo real del plano de mesas, traslado de cuentas y ocupación.
 */
@ApiTags('Mesas')
@ApiBearerAuth('JWT-auth')
@Controller('mesas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  /**
   * Registra una nueva mesa física en el plano del salón.
   * Exclusivo para administradores.
   *
   * @param createMesaDto Datos de la mesa (número único, estado inicial).
   * @returns Mesa creada en la base de datos.
   */
  @ApiOperation({ summary: 'Crear nueva mesa (Solo Administrador)' })
  @ApiBody({ type: CreateMesaDto })
  @ApiResponse({ status: 201, description: 'Mesa registrada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 409, description: 'Ya existe una mesa con ese número.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador)
  crear(@Body() createMesaDto: CreateMesaDto) {
    return this.mesasService.crear(createMesaDto);
  }

  /**
   * Traslada atómicamente todas las comandas activas de una mesa a otra.
   * La mesa origen se libera y la destino pasa a estar ocupada.
   *
   * @param transferirMesaDto Identificadores de mesa origen y destino.
   * @returns Resultado de la reasignación de comandas.
   */
  @ApiOperation({
    summary: 'Transferir comandas entre mesas',
    description: 'Mueve todos los pedidos activos de la mesa origen a la mesa destino de forma transaccional.',
  })
  @ApiBody({ type: TransferirMesaDto })
  @ApiResponse({ status: 200, description: 'Comandas transferidas exitosamente.' })
  @ApiResponse({ status: 400, description: 'Mesa destino no disponible o mesa origen sin comandas.' })
  @ApiResponse({ status: 404, description: 'Mesa origen o destino no encontrada.' })
  @Post('transferir')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  transferir(@Body() transferirMesaDto: TransferirMesaDto) {
    return this.mesasService.transferirMesa(transferirMesaDto);
  }

  /**
   * Consulta el listado de mesas con filtros opcionales por estado operativo.
   *
   * @param query Filtro de estado (libre u ocupada).
   * @returns Lista de mesas con sus pedidos activos.
   */
  @ApiOperation({ summary: 'Listar mesas con estado y comandas activas' })
  @ApiResponse({ status: 200, description: 'Plano de mesas obtenido exitosamente.' })
  @Get()
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerTodas(@Query() query: QueryMesaDto) {
    return this.mesasService.obtenerTodas(query);
  }

  /**
   * Consulta una mesa específica por su ID.
   *
   * @param id Identificador numérico de la mesa.
   * @returns Mesa con sus ítems y pedidos en preparación.
   */
  @ApiOperation({ summary: 'Obtener mesa por ID con sus pedidos activos' })
  @ApiParam({ name: 'id', description: 'ID de la mesa', example: 1 })
  @ApiResponse({ status: 200, description: 'Mesa encontrada.' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada.' })
  @Get(':id')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.obtenerPorId(id);
  }

  /**
   * Modifica manualmente el estado operativo de una mesa (libre / ocupada).
   *
   * @param id Identificador de la mesa.
   * @param cambiarEstadoDto Nuevo estado deseado.
   * @returns Mesa actualizada.
   */
  @ApiOperation({ summary: 'Cambiar estado de mesa (libre / ocupada)' })
  @ApiParam({ name: 'id', description: 'ID de la mesa', example: 1 })
  @ApiBody({ type: CambiarEstadoMesaDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada.' })
  @Patch(':id/estado')
  @Roles(RolUsuario.administrador, RolUsuario.cajero, RolUsuario.mesero)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoMesaDto,
  ) {
    return this.mesasService.cambiarEstado(id, cambiarEstadoDto);
  }

  /**
   * Actualiza el número o configuración de una mesa. Solo administradores.
   *
   * @param id Identificador de la mesa.
   * @param updateMesaDto Propiedades a modificar.
   * @returns Mesa actualizada.
   */
  @ApiOperation({ summary: 'Actualizar mesa (Solo Administrador)' })
  @ApiParam({ name: 'id', description: 'ID de la mesa', example: 1 })
  @ApiBody({ type: UpdateMesaDto })
  @ApiResponse({ status: 200, description: 'Mesa actualizada correctamente.' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada.' })
  @Patch(':id')
  @Roles(RolUsuario.administrador)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMesaDto: UpdateMesaDto,
  ) {
    return this.mesasService.actualizar(id, updateMesaDto);
  }

  /**
   * Elimina una mesa físicamente si no tiene comandas ni facturas históricas asociadas.
   *
   * @param id Identificador de la mesa.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({ summary: 'Eliminar mesa (Solo Administrador)' })
  @ApiParam({ name: 'id', description: 'ID de la mesa a eliminar', example: 7 })
  @ApiResponse({ status: 200, description: 'Mesa eliminada correctamente.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar una mesa con historial operativo.' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada.' })
  @Delete(':id')
  @Roles(RolUsuario.administrador)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.eliminar(id);
  }
}
