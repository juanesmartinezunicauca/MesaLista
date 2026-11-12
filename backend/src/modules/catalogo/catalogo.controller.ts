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
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CatalogoService } from './catalogo.service';
import {
  CambiarDisponibilidadDto,
  CreateAjusteInventarioDto,
  CreateProductoDto,
  QueryProductoDto,
  UpdateProductoDto,
} from './dto';

/**
 * Controlador del Catálogo de Productos y Control de Inventario
 * Expone la carta gastronómica para comandería, portal cliente y administración de insumos.
 */
@ApiTags('Catálogo')
@Controller('catalogo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  /**
   * Registra un nuevo producto en la carta gastronómica.
   * Exclusivo para administradores.
   *
   * @param createProductoDto Ficha técnica del producto (nombre, precio, costo, ingredientes, inventario).
   * @returns Producto registrado en la base de datos.
   */
  @ApiOperation({ summary: 'Crear nuevo producto (Solo Administrador)' })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateProductoDto })
  @ApiResponse({ status: 201, description: 'Producto registrado exitosamente en el catálogo.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o precio negativo.' })
  @Post('productos')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador)
  crearProducto(@Body() createProductoDto: CreateProductoDto) {
    return this.catalogoService.crear(createProductoDto);
  }

  /**
   * Consulta el catálogo de productos con filtros opcionales.
   * Endpoint público utilizado por comandería y la vista pública del cliente.
   *
   * @param query Filtros por categoría, disponibilidad o término de búsqueda.
   * @returns Lista de productos del catálogo.
   */
  @ApiOperation({
    summary: 'Listar productos del catálogo (Público)',
    description: 'Permite consultar los platos de la carta filtrados por categoría, disponibilidad o nombre.',
  })
  @ApiResponse({ status: 200, description: 'Catálogo obtenido exitosamente.' })
  @Public()
  @Get('productos')
  obtenerProductos(@Query() query: QueryProductoDto) {
    return this.catalogoService.obtenerTodos(query);
  }

  /**
   * Obtiene la lista única de categorías registradas en la carta.
   * Endpoint público sin requerimiento de autenticación.
   *
   * @returns Lista de categorías (ej. Pizzas, Pastas, Bebidas).
   */
  @ApiOperation({
    summary: 'Listar categorías de la carta (Público)',
    description: 'Retorna los nombres de todas las categorías disponibles.',
  })
  @ApiResponse({ status: 200, description: 'Categorías obtenidas exitosamente.' })
  @Public()
  @Get('categorias')
  obtenerCategorias() {
    return this.catalogoService.obtenerCategorias();
  }

  /**
   * Obtiene la información técnica de un producto por su ID.
   *
   * @param id Identificador numérico del producto.
   * @returns Ficha del producto con costo, precio y existencias.
   */
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto', example: 1 })
  @ApiResponse({ status: 200, description: 'Producto encontrado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @Get('productos/:id')
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cocina,
  )
  obtenerProductoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.obtenerPorId(id);
  }

  /**
   * Actualiza las propiedades técnicas, comerciales o fotográficas de un producto.
   *
   * @param id Identificador del producto.
   * @param updateProductoDto Datos a modificar.
   * @returns Producto actualizado.
   */
  @ApiOperation({ summary: 'Actualizar producto (Solo Administrador)' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto', example: 1 })
  @ApiBody({ type: UpdateProductoDto })
  @ApiResponse({ status: 200, description: 'Producto actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @Patch('productos/:id')
  @Roles(RolUsuario.administrador)
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.catalogoService.actualizar(id, updateProductoDto);
  }

  /**
   * Alterna la disponibilidad inmediata de un plato para comandería.
   *
   * @param id Identificador del producto.
   * @param dto Booleano de disponibilidad.
   * @returns Producto con disponibilidad actualizada.
   */
  @ApiOperation({ summary: 'Cambiar disponibilidad inmediata del producto' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto', example: 1 })
  @ApiBody({ type: CambiarDisponibilidadDto })
  @ApiResponse({ status: 200, description: 'Disponibilidad actualizada.' })
  @Patch('productos/:id/disponibilidad')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cambiarDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarDisponibilidadDto,
  ) {
    return this.catalogoService.cambiarDisponibilidad(id, dto.disponible);
  }

  /**
   * Elimina un producto si no cuenta con historial de ventas en comandas cerradas.
   *
   * @param id Identificador del producto.
   * @returns Confirmación de eliminación.
   */
  @ApiOperation({ summary: 'Eliminar producto (Solo Administrador)' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto a eliminar', example: 5 })
  @ApiResponse({ status: 200, description: 'Producto eliminado correctamente.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar un producto con historial de ventas.' })
  @Delete('productos/:id')
  @Roles(RolUsuario.administrador)
  eliminarProducto(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.eliminar(id);
  }

  /**
   * Registra un movimiento de ajuste de inventario (Entrada, Merma o Arqueo físico).
   *
   * @param id Identificador del producto a ajustar.
   * @param dto Tipo de ajuste, cantidad y justificación obligatoria.
   * @param id_usuario Identificador del administrador responsable.
   * @returns Registro histórico del movimiento con stock actualizado.
   */
  @ApiOperation({
    summary: 'Registrar ajuste de inventario (Entrada, Merma, Arqueo)',
    description: 'Genera un asiento de ajuste de existencias trazable con usuario responsable y motivo.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto', example: 1 })
  @ApiBody({ type: CreateAjusteInventarioDto })
  @ApiResponse({ status: 201, description: 'Ajuste de inventario registrado exitosamente.' })
  @ApiResponse({ status: 400, description: 'El producto no controla inventario o datos inválidos.' })
  @Post('productos/:id/ajustes')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador)
  registrarAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAjusteInventarioDto,
    @CurrentUser('id_usuario') id_usuario: number,
  ) {
    return this.catalogoService.registrarAjusteInventario(id, id_usuario, dto);
  }

  /**
   * Consulta el historial completo de ajustes de inventario de un producto.
   *
   * @param id Identificador del producto.
   * @returns Lista histórica de entradas, mermas y arqueos.
   */
  @ApiOperation({ summary: 'Consultar bitácora de ajustes de inventario del producto' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID del producto', example: 1 })
  @ApiResponse({ status: 200, description: 'Historial de ajustes obtenido.' })
  @Get('productos/:id/ajustes')
  @Roles(RolUsuario.administrador)
  obtenerAjustes(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.obtenerAjustesProducto(id);
  }
}
