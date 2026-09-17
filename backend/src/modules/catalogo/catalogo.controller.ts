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
import { CatalogoService } from './catalogo.service';
import {
  CambiarDisponibilidadDto,
  CreateAjusteInventarioDto,
  CreateProductoDto,
  QueryProductoDto,
  UpdateProductoDto,
} from './dto';

@Controller('catalogo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  /**
   * POST /api/v1/catalogo/productos
   * Registra un nuevo producto en la carta. Exclusivo para administradores.
   */
  @Post('productos')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolUsuario.administrador)
  crearProducto(@Body() createProductoDto: CreateProductoDto) {
    return this.catalogoService.crear(createProductoDto);
  }

  /**
   * GET /api/v1/catalogo/productos
   * Consulta el catálogo con filtros opcionales (categoría, disponible, búsqueda).
   * Disponible para todos los roles operativos.
   */
  @Get('productos')
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cocina,
  )
  obtenerProductos(@Query() query: QueryProductoDto) {
    return this.catalogoService.obtenerTodos(query);
  }

  /**
   * GET /api/v1/catalogo/categorias
   * Lista las categorías existentes en el catálogo.
   * NOTA: Definido antes de :id para evitar colisiones de ruta.
   */
  @Get('categorias')
  @Roles(
    RolUsuario.administrador,
    RolUsuario.cajero,
    RolUsuario.mesero,
    RolUsuario.cocina,
  )
  obtenerCategorias() {
    return this.catalogoService.obtenerCategorias();
  }

  /**
   * GET /api/v1/catalogo/productos/:id
   * Obtiene la ficha técnica y económica de un producto específico.
   */
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
   * PATCH /api/v1/catalogo/productos/:id
   * Actualiza propiedades de un producto. Exclusivo para administradores.
   */
  @Patch('productos/:id')
  @Roles(RolUsuario.administrador)
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.catalogoService.actualizar(id, updateProductoDto);
  }

  /**
   * PATCH /api/v1/catalogo/productos/:id/disponibilidad
   * Alterna la disponibilidad inmediata de un producto. Acceso para admin y cajero.
   */
  @Patch('productos/:id/disponibilidad')
  @Roles(RolUsuario.administrador, RolUsuario.cajero)
  cambiarDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarDisponibilidadDto,
  ) {
    return this.catalogoService.cambiarDisponibilidad(id, dto.disponible);
  }

  /**
   * DELETE /api/v1/catalogo/productos/:id
   * Elimina un producto si no tiene historial comercial en comandas.
   */
  @Delete('productos/:id')
  @Roles(RolUsuario.administrador)
  eliminarProducto(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.eliminar(id);
  }

  /**
   * POST /api/v1/catalogo/productos/:id/ajustes
   * Registra un movimiento de ajuste de inventario (Entrada, Merma, Arqueo).
   */
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
   * GET /api/v1/catalogo/productos/:id/ajustes
   * Obtiene la bitácora histórica de ajustes de inventario del producto.
   */
  @Get('productos/:id/ajustes')
  @Roles(RolUsuario.administrador)
  obtenerAjustes(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.obtenerAjustesProducto(id);
  }
}
