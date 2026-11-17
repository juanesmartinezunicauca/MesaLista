import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoFactura, EstadoMesa, EstadoPedido, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolverRangoFechaOpcional } from '../../common/utils/date-range.util';
import {
  CambiarEstadoPedidoDto,
  CreatePedidoDto,
  QueryPedidoDto,
  UpdatePedidoDto,
} from './dto';

@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  // Proyección optimizada para excluir imágenes Base64 pesadas en consultas operativas de comandas y cocina
  private readonly productoSelectOperativo = {
    id_producto: true,
    nombre: true,
    categoria: true,
    precio_venta: true,
    costo: true,
    controla_inventario: true,
    cantidad_inventario: true,
    disponible: true,
  } as const;

  /**
   * Registra una nueva comanda (salón o domicilio) congelando los precios históricos
   * de cada producto, validando/descontando inventario y actualizando la mesa a ocupada.
   */
  async crear(createPedidoDto: CreatePedidoDto, id_usuario: number) {
    // 1. Validaciones de coherencia según el tipo de pedido
    if (createPedidoDto.tipo === TipoPedido.salon && !createPedidoDto.id_mesa) {
      throw new BadRequestException(
        'Para pedidos de salón se requiere especificar el ID de la mesa.',
      );
    }

    // 2. Verificar existencia de la mesa si es salón
    if (createPedidoDto.tipo === TipoPedido.salon && createPedidoDto.id_mesa) {
      const mesa = await this.prisma.mesa.findUnique({
        where: { id_mesa: createPedidoDto.id_mesa },
      });
      if (!mesa) {
        throw new NotFoundException(
          `La mesa con ID #${createPedidoDto.id_mesa} no fue encontrada.`,
        );
      }
    }



    // 3. Verificar productos en catálogo, disponibilidad y stock
    const productIds = createPedidoDto.items.map((i) => i.id_producto);
    const productos = await this.prisma.producto.findMany({
      where: { id_producto: { in: productIds } },
    });

    const productMap = new Map(productos.map((p) => [p.id_producto, p]));
    const cantidadPorProducto = new Map<number, number>();

    for (const item of createPedidoDto.items) {
      const prod = productMap.get(item.id_producto);
      if (!prod) {
        throw new NotFoundException(
          `El producto con ID #${item.id_producto} no existe en la carta.`,
        );
      }
      if (!prod.disponible) {
        throw new BadRequestException(
          `El producto '${prod.nombre}' no se encuentra disponible actualmente.`,
        );
      }
      const acumulado = (cantidadPorProducto.get(item.id_producto) || 0) + item.cantidad;
      cantidadPorProducto.set(item.id_producto, acumulado);
      if (prod.controla_inventario && (prod.cantidad_inventario ?? 0) < acumulado) {
        throw new BadRequestException(
          `Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.cantidad_inventario}, solicitado: ${acumulado}.`,
        );
      }
    }

    // 4. Transacción atómica de persistencia, descuento de inventario y transición de mesa
    return this.prisma.$transaction(async (tx) => {
      // Calcular consecutivo diario en zona horaria local de Colombia (America/Bogota - UTC-5)
      const ahora = new Date();
      const fechaColStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(ahora);

      const inicioDiaCol = new Date(`${fechaColStr}T00:00:00.000-05:00`);

      const ultimoPedidoHoy = await tx.pedido.findFirst({
        where: { fecha_hora: { gte: inicioDiaCol } },
        orderBy: { numero_pedido: 'desc' },
      });

      const numero_pedido = (ultimoPedidoHoy?.numero_pedido ?? 0) + 1;

      const pedidoCreado = await tx.pedido.create({
        data: {
          numero_pedido,
          tipo: createPedidoDto.tipo,
          estado: EstadoPedido.enviada,
          id_usuario,
          id_mesa:
            createPedidoDto.tipo === TipoPedido.salon
              ? createPedidoDto.id_mesa
              : null,
          observacion: createPedidoDto.observacion ? createPedidoDto.observacion.trim().slice(0, 255) : undefined,
          items: {
            create: createPedidoDto.items.map((item) => ({
              id_producto: item.id_producto,
              cantidad: item.cantidad,
              ingredientes_removidos: item.ingredientes_removidos ? item.ingredientes_removidos.trim().slice(0, 255) : undefined,
              observacion: item.observacion ? item.observacion.trim().slice(0, 255) : undefined,
              // Regla crítica: precio congelado de la carta al momento de ordenar
              precio_unitario: productMap.get(item.id_producto)!.precio_venta,
            })),
          },
        },
        include: {
          mesa: true,
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              rol: true,
            },
          },
          items: {
            include: {
              producto: {
                select: this.productoSelectOperativo,
              },
            },
          },
        },
      });

      // Descontar inventario automáticamente para productos con control de stock
      for (const item of createPedidoDto.items) {
        const prod = productMap.get(item.id_producto);
        if (prod?.controla_inventario) {
          await tx.producto.update({
            where: { id_producto: item.id_producto },
            data: {
              cantidad_inventario: {
                decrement: item.cantidad,
              },
            },
          });
        }
      }

      // Si es salón, transicionar la mesa a 'ocupada'
      if (
        createPedidoDto.tipo === TipoPedido.salon &&
        createPedidoDto.id_mesa
      ) {
        await tx.mesa.update({
          where: { id_mesa: createPedidoDto.id_mesa },
          data: { estado: EstadoMesa.ocupada },
        });
      }

      return pedidoCreado;
    });
  }

  /**
   * Consulta pedidos con filtros opcionales (estado, tipo, mesa, cliente, fecha).
   */
  async obtenerTodos(filtros?: QueryPedidoDto) {
    const where: any = {};

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    if (filtros?.tipo) {
      where.tipo = filtros.tipo;
    }

    if (filtros?.id_mesa) {
      where.id_mesa = filtros.id_mesa;
    }



    const rangoFecha = resolverRangoFechaOpcional(filtros);
    if (rangoFecha) {
      where.fecha_hora = rangoFecha;
    }

    // Excluir pedidos a domicilio pendientes de aprobación por el cajero (aún no van a cocina)
    where.NOT = [
      {
        tipo: TipoPedido.domicilio,
        observacion: { contains: '[PENDIENTE]' },
      },
    ];

    return this.prisma.pedido.findMany({
      where,
      orderBy: { fecha_hora: 'desc' },
      include: {
        mesa: true,
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            rol: true,
          },
        },
        items: {
          include: {
            producto: {
              select: this.productoSelectOperativo,
            },
          },
        },
      },
    });
  }

  /**
   * Consulta el detalle de un pedido por su identificador único.
   */
  async obtenerPorId(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: {
        mesa: true,
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            rol: true,
          },
        },
        items: {
          include: {
            producto: {
              select: this.productoSelectOperativo,
            },
          },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException(`El pedido #${id} no fue encontrado.`);
    }

    return pedido;
  }

  /**
   * Consulta las comandas activas ('enviada') de una mesa específica.
   */
  async obtenerPorMesa(id_mesa: number) {
    return this.prisma.pedido.findMany({
      where: {
        id_mesa,
        estado: EstadoPedido.enviada,
      },
      orderBy: { fecha_hora: 'asc' },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
          },
        },
        items: {
          include: {
            producto: {
              select: this.productoSelectOperativo,
            },
          },
        },
      },
    });
  }

  /**
   * Actualiza el estado de una comanda (ej. cerrada o cancelada).
   * Si se cancela y la mesa no cuenta con otros pedidos activos, libera la mesa.
   */
  async cambiarEstado(id: number, cambiarEstadoDto: CambiarEstadoPedidoDto) {
    const pedido = await this.obtenerPorId(id);

    if (pedido.estado === EstadoPedido.cerrada) {
      throw new BadRequestException(
        'No se puede modificar el estado de un pedido que ya ha sido facturado y cerrado.',
      );
    }

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id_pedido: id },
      data: { estado: cambiarEstadoDto.estado },
      include: {
        mesa: true,
        items: {
          include: {
            producto: {
              select: this.productoSelectOperativo,
            },
          },
        },
      },
    });

    // Si se cancela y es de salón, revisar si la mesa queda libre
    if (
      cambiarEstadoDto.estado === EstadoPedido.cancelada &&
      pedido.id_mesa
    ) {
      const pedidosActivosMesa = await this.prisma.pedido.count({
        where: {
          id_mesa: pedido.id_mesa,
          estado: EstadoPedido.enviada,
        },
      });

      if (pedidosActivosMesa === 0) {
        await this.prisma.mesa.update({
          where: { id_mesa: pedido.id_mesa },
          data: { estado: EstadoMesa.libre },
        });
      }
    }

    // Si se cancela la comanda, restituir existencias en inventario para productos controlados
    if (
      cambiarEstadoDto.estado === EstadoPedido.cancelada &&
      pedido.estado !== EstadoPedido.cancelada
    ) {
      for (const item of (pedido.items || [])) {
        if (item.producto?.controla_inventario) {
          await this.prisma.producto.update({
            where: { id_producto: item.id_producto },
            data: {
              cantidad_inventario: {
                increment: item.cantidad,
              },
            },
          });
        }
      }
    }

    return pedidoActualizado;
  }

  /**
   * Cancela una comanda activa.
   */
  async cancelar(id: number) {
    return this.cambiarEstado(id, { estado: EstadoPedido.cancelada });
  }

  /**
   * Actualiza datos de un pedido desde historial (cajero o administrador).
   */
  async actualizar(id: number, dto: UpdatePedidoDto) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
    });

    if (!pedido) {
      throw new NotFoundException(`El pedido #${id} no fue encontrado.`);
    }

    if (dto.estado === EstadoPedido.cancelada && pedido.estado !== EstadoPedido.cancelada) {
      if (dto.observacion !== undefined || dto.id_mesa !== undefined) {
        await this.prisma.pedido.update({
          where: { id_pedido: id },
          data: {
            ...(dto.observacion !== undefined && {
              observacion: dto.observacion ? dto.observacion.trim().slice(0, 255) : null,
            }),
            ...(dto.id_mesa !== undefined && { id_mesa: dto.id_mesa }),
          },
        });
      }
      return this.cambiarEstado(id, { estado: EstadoPedido.cancelada });
    }

    const data: any = {};
    if (dto.observacion !== undefined) {
      data.observacion = dto.observacion ? dto.observacion.trim().slice(0, 255) : null;
    }
    if (dto.id_mesa !== undefined) {
      data.id_mesa = dto.id_mesa;
    }
    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    return this.prisma.pedido.update({
      where: { id_pedido: id },
      data,
      include: {
        mesa: true,
        usuario: {
          select: { id_usuario: true, nombre: true, rol: true },
        },
        items: {
          include: {
            producto: { select: this.productoSelectOperativo },
          },
        },
      },
    });
  }

  /**
   * Elimina un pedido histórico (exclusivo para super administrador).
   */
  async eliminar(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: {
        factura: true,
        items: {
          include: { producto: true },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException(`El pedido #${id} no fue encontrado.`);
    }

    if (pedido.factura && pedido.factura.estado === EstadoFactura.emitida) {
      throw new BadRequestException(
        `No se puede eliminar el pedido #${pedido.numero_pedido} porque está vinculado a la factura activa #FAC-${pedido.id_factura}. Anule primero la factura en caja para preservar la integridad contable y de costos.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Si el pedido seguía activo (enviada), restituir el stock descontado antes de eliminar
      if (pedido.estado === EstadoPedido.enviada) {
        for (const item of pedido.items || []) {
          if (item.producto?.controla_inventario) {
            await tx.producto.update({
              where: { id_producto: item.id_producto },
              data: {
                cantidad_inventario: {
                  increment: item.cantidad,
                },
              },
            });
          }
        }
      }

      await tx.itemPedido.deleteMany({
        where: { id_pedido: id },
      });

      await tx.pedido.delete({
        where: { id_pedido: id },
      });

      if (pedido.id_mesa) {
        const activos = await tx.pedido.count({
          where: { id_mesa: pedido.id_mesa, estado: EstadoPedido.enviada },
        });
        if (activos === 0) {
          await tx.mesa.update({
            where: { id_mesa: pedido.id_mesa },
            data: { estado: EstadoMesa.libre },
          });
        }
      }

      return {
        success: true,
        mensaje: `Pedido #${pedido.numero_pedido} eliminado exitosamente del historial.`,
      };
    });
  }
}

