import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoMesa, EstadoPedido, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CambiarEstadoPedidoDto,
  CreatePedidoDto,
  QueryPedidoDto,
} from './dto';

@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una nueva comanda (salón o domicilio) congelando los precios históricos
   * de cada producto y actualizando la mesa a ocupada en caso de pedido en salón.
   */
  async crear(createPedidoDto: CreatePedidoDto, id_usuario: number) {
    // 1. Validaciones de coherencia según el tipo de pedido
    if (createPedidoDto.tipo === TipoPedido.salon && !createPedidoDto.id_mesa) {
      throw new BadRequestException(
        'Para pedidos de salón se requiere especificar el ID de la mesa.',
      );
    }

    if (
      createPedidoDto.tipo === TipoPedido.domicilio &&
      !createPedidoDto.id_cliente
    ) {
      throw new BadRequestException(
        'Para pedidos a domicilio se requiere especificar el ID del cliente.',
      );
    }

    // 2. Verificar existencia de la mesa o cliente
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

    if (
      createPedidoDto.tipo === TipoPedido.domicilio &&
      createPedidoDto.id_cliente
    ) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: createPedidoDto.id_cliente },
      });
      if (!cliente) {
        throw new NotFoundException(
          `El cliente con ID #${createPedidoDto.id_cliente} no fue encontrado.`,
        );
      }
    }

    // 3. Verificar productos en catálogo y disponibilidad
    const productIds = createPedidoDto.items.map((i) => i.id_producto);
    const productos = await this.prisma.producto.findMany({
      where: { id_producto: { in: productIds } },
    });

    const productMap = new Map(productos.map((p) => [p.id_producto, p]));

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
    }

    // 4. Calcular el consecutivo diario del pedido
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const ultimoPedidoHoy = await this.prisma.pedido.findFirst({
      where: { fecha_hora: { gte: inicioDia } },
      orderBy: { numero_pedido: 'desc' },
    });

    const numero_pedido = (ultimoPedidoHoy?.numero_pedido ?? 0) + 1;

    // 5. Transacción de persistencia con congelamiento de precio y transición de mesa
    return this.prisma.$transaction(async (tx) => {
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
          id_cliente:
            createPedidoDto.tipo === TipoPedido.domicilio
              ? createPedidoDto.id_cliente
              : null,
          observacion: createPedidoDto.observacion,
          items: {
            create: createPedidoDto.items.map((item) => ({
              id_producto: item.id_producto,
              cantidad: item.cantidad,
              ingredientes_removidos: item.ingredientes_removidos,
              observacion: item.observacion,
              // Regla crítica: precio congelado de la carta al momento de ordenar
              precio_unitario: productMap.get(item.id_producto)!.precio_venta,
            })),
          },
        },
        include: {
          mesa: true,
          cliente: true,
          usuario: {
            select: {
              id_usuario: true,
              nombre: true,
              rol: true,
            },
          },
          items: {
            include: {
              producto: true,
            },
          },
        },
      });

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

    if (filtros?.id_cliente) {
      where.id_cliente = filtros.id_cliente;
    }

    if (filtros?.fecha) {
      const fechaInicio = new Date(filtros.fecha);
      fechaInicio.setHours(0, 0, 0, 0);

      const fechaFin = new Date(filtros.fecha);
      fechaFin.setHours(23, 59, 59, 999);

      where.fecha_hora = {
        gte: fechaInicio,
        lte: fechaFin,
      };
    }

    return this.prisma.pedido.findMany({
      where,
      orderBy: { fecha_hora: 'desc' },
      include: {
        mesa: true,
        cliente: true,
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            rol: true,
          },
        },
        items: {
          include: {
            producto: true,
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
        cliente: true,
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            rol: true,
          },
        },
        items: {
          include: {
            producto: true,
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
            producto: true,
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
        cliente: true,
        items: {
          include: {
            producto: true,
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

    return pedidoActualizado;
  }

  /**
   * Cancela una comanda activa.
   */
  async cancelar(id: number) {
    return this.cambiarEstado(id, { estado: EstadoPedido.cancelada });
  }
}
