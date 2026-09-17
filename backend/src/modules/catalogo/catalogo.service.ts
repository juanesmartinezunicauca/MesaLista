import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoAjuste } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAjusteInventarioDto,
  CreateProductoDto,
  QueryProductoDto,
  UpdateProductoDto,
} from './dto';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un nuevo producto en la carta/catálogo asegurando nombre único.
   */
  async crear(createProductoDto: CreateProductoDto) {
    const nombreNormalizado = createProductoDto.nombre.trim();

    const productoExistente = await this.prisma.producto.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: 'insensitive',
        },
      },
    });

    if (productoExistente) {
      throw new ConflictException(
        `El producto '${nombreNormalizado}' ya se encuentra registrado en el catálogo.`,
      );
    }

    let ingredientesStr: string | null = null;
    if (createProductoDto.ingredientes_removibles) {
      ingredientesStr = Array.isArray(createProductoDto.ingredientes_removibles)
        ? createProductoDto.ingredientes_removibles.join(', ')
        : createProductoDto.ingredientes_removibles;
    }

    return this.prisma.producto.create({
      data: {
        nombre: nombreNormalizado,
        categoria: createProductoDto.categoria.trim(),
        precio_venta: createProductoDto.precio_venta,
        costo: createProductoDto.costo,
        ingredientes_removibles: ingredientesStr,
        cantidad_inventario: createProductoDto.cantidad_inventario ?? 0,
        disponible: createProductoDto.disponible ?? true,
      },
    });
  }

  /**
   * Consulta el catálogo de productos con filtros opcionales de categoría,
   * disponibilidad y búsqueda por coincidencia de nombre.
   */
  async obtenerTodos(query?: QueryProductoDto) {
    const where: any = {};

    if (query?.categoria) {
      where.categoria = {
        equals: query.categoria,
        mode: 'insensitive',
      };
    }

    if (query?.disponible !== undefined) {
      where.disponible = query.disponible;
    }

    if (query?.busqueda) {
      where.nombre = {
        contains: query.busqueda.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.producto.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Obtiene la información detallada de un producto por su ID.
   */
  async obtenerPorId(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id_producto: id },
    });

    if (!producto) {
      throw new NotFoundException(`El producto con ID #${id} no fue encontrado.`);
    }

    return producto;
  }

  /**
   * Actualiza los datos operativos o económicos de un producto.
   */
  async actualizar(id: number, updateProductoDto: UpdateProductoDto) {
    const producto = await this.obtenerPorId(id);

    if (updateProductoDto.nombre) {
      const nombreNormalizado = updateProductoDto.nombre.trim();
      const duplicado = await this.prisma.producto.findFirst({
        where: {
          nombre: {
            equals: nombreNormalizado,
            mode: 'insensitive',
          },
          NOT: {
            id_producto: id,
          },
        },
      });

      if (duplicado) {
        throw new ConflictException(
          `Ya existe otro producto con el nombre '${nombreNormalizado}'.`,
        );
      }
    }

    let ingredientesStr: string | undefined = undefined;
    if (updateProductoDto.ingredientes_removibles !== undefined) {
      ingredientesStr = Array.isArray(updateProductoDto.ingredientes_removibles)
        ? updateProductoDto.ingredientes_removibles.join(', ')
        : updateProductoDto.ingredientes_removibles;
    }

    return this.prisma.producto.update({
      where: { id_producto: id },
      data: {
        ...(updateProductoDto.nombre && { nombre: updateProductoDto.nombre.trim() }),
        ...(updateProductoDto.categoria && { categoria: updateProductoDto.categoria.trim() }),
        ...(updateProductoDto.precio_venta !== undefined && {
          precio_venta: updateProductoDto.precio_venta,
        }),
        ...(updateProductoDto.costo !== undefined && { costo: updateProductoDto.costo }),
        ...(ingredientesStr !== undefined && { ingredientes_removibles: ingredientesStr }),
        ...(updateProductoDto.cantidad_inventario !== undefined && {
          cantidad_inventario: updateProductoDto.cantidad_inventario,
        }),
        ...(updateProductoDto.disponible !== undefined && {
          disponible: updateProductoDto.disponible,
        }),
      },
    });
  }

  /**
   * Modifica rápidamente la disponibilidad de un producto en la carta.
   */
  async cambiarDisponibilidad(id: number, disponible: boolean) {
    await this.obtenerPorId(id);

    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { disponible },
    });
  }

  /**
   * Elimina un producto de forma física si no tiene historial comercial en pedidos.
   */
  async eliminar(id: number) {
    const producto = await this.obtenerPorId(id);

    const pedidosCount = await this.prisma.itemPedido.count({
      where: { id_producto: id },
    });

    if (pedidosCount > 0) {
      throw new ConflictException(
        `No es posible eliminar el producto '${producto.nombre}' porque cuenta con ${pedidosCount} registro(s) histórico(s) en comandas. Desactiva su disponibilidad en su lugar.`,
      );
    }

    await this.prisma.ajusteInventario.deleteMany({
      where: { id_producto: id },
    });

    await this.prisma.producto.delete({
      where: { id_producto: id },
    });

    return {
      mensaje: `Producto '${producto.nombre}' eliminado correctamente del catálogo.`,
    };
  }

  /**
   * Registra un ajuste de inventario atómico (Entrada, Merma, Arqueo)
   * actualizando la existencia del producto y almacenando la trazabilidad.
   */
  async registrarAjusteInventario(
    id_producto: number,
    id_usuario: number,
    dto: CreateAjusteInventarioDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id_producto },
      });

      if (!producto) {
        throw new NotFoundException(`El producto con ID #${id_producto} no existe.`);
      }

      const usuario = await tx.usuario.findUnique({
        where: { id_usuario },
      });

      if (!usuario) {
        throw new NotFoundException(`El usuario con ID #${id_usuario} no fue encontrado.`);
      }

      let nuevoStock = producto.cantidad_inventario;

      if (dto.tipo_ajuste === TipoAjuste.Entrada) {
        nuevoStock += dto.cantidad;
      } else if (dto.tipo_ajuste === TipoAjuste.Merma) {
        if (producto.cantidad_inventario < dto.cantidad) {
          throw new BadRequestException(
            `La cantidad de merma (${dto.cantidad}) supera el stock actual en inventario (${producto.cantidad_inventario}).`,
          );
        }
        nuevoStock -= dto.cantidad;
      } else if (dto.tipo_ajuste === TipoAjuste.Arqueo) {
        nuevoStock = dto.cantidad;
      }

      await tx.producto.update({
        where: { id_producto },
        data: { cantidad_inventario: nuevoStock },
      });

      const ajuste = await tx.ajusteInventario.create({
        data: {
          id_producto,
          id_usuario,
          tipo_ajuste: dto.tipo_ajuste,
          cantidad: dto.cantidad,
          motivo: dto.motivo.trim(),
        },
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              usuario: true,
              rol: true,
            },
          },
        },
      });

      return {
        ajuste,
        stock_anterior: producto.cantidad_inventario,
        nuevo_stock: nuevoStock,
      };
    });
  }

  /**
   * Consulta el historial de ajustes de inventario de un producto.
   */
  async obtenerAjustesProducto(id_producto: number) {
    await this.obtenerPorId(id_producto);

    return this.prisma.ajusteInventario.findMany({
      where: { id_producto },
      orderBy: { fecha_hora: 'desc' },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            usuario: true,
            rol: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene la lista de nombres únicos de categorías existentes en el catálogo.
   */
  async obtenerCategorias() {
    const productos = await this.prisma.producto.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    });

    return productos.map((p) => p.categoria);
  }
}
