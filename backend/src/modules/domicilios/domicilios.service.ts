import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCaja, EstadoPedido, TipoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoDomicilioDto, CreateDomicilioDto } from './dto';

@Injectable()
export class DomiciliosService {
  constructor(private readonly prisma: PrismaService) {}

  private recibiendoDomicilios: boolean = true;
  private motivoPausa?: string;

  /**
   * Consulta el estado de servicio de domicilios y disponibilidad de atención.
   * Valida si el restaurante tiene una caja activa abierta y si la recepción de domicilios está habilitada.
   * Seguro: No expone saldos ni información sensible de caja.
   */
  async obtenerEstadoServicio() {
    const cajaAbierta = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
      select: { id_caja: true, fecha_apertura: true },
    });

    const activo = Boolean(cajaAbierta) && this.recibiendoDomicilios;
    let motivo: string | undefined;

    if (!cajaAbierta) {
      motivo = 'El restaurante se encuentra cerrado en este momento (sin turno de caja activo).';
    } else if (!this.recibiendoDomicilios) {
      motivo = this.motivoPausa || 'Recepción de domicilios pausada temporalmente por el personal.';
    }

    return {
      activo,
      cajaAbierta: Boolean(cajaAbierta),
      recibiendoDomicilios: this.recibiendoDomicilios,
      motivo,
    };
  }

  /**
   * Permite al personal (cajero/admin) activar o pausar la recepción de domicilios.
   */
  async cambiarRecepcionDomicilios(recibiendo: boolean, motivo?: string) {
    this.recibiendoDomicilios = Boolean(recibiendo);
    this.motivoPausa = motivo ? motivo.trim().slice(0, 255) : undefined;

    return this.obtenerEstadoServicio();
  }

  // Proyección optimizada de productos para comandas operativas (sin imágenes base64 pesadas)
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

  // Inclusión estándar para pedidos de tipo domicilio
  private readonly domicilioInclude = {
    cliente: true,
    usuario: {
      select: {
        id_usuario: true,
        nombre: true,
        rol: true,
      },
    },
    factura: {
      include: {
        pagos: {
          include: {
            medioPago: true,
          },
        },
      },
    },
    items: {
      include: {
        producto: {
          select: this.productoSelectOperativo,
        },
      },
    },
  } as const;

  /**
   * Crea un nuevo pedido a domicilio.
   * Busca o registra el cliente, valida stock y disponibilidad de productos,
   * desglosa y congela precios unitarios históricos y asigna consecutivo diario.
   */
  async crear(createDto: CreateDomicilioDto, id_usuario: number) {
    const { cliente: clienteDto, items, observacion, metodo_pago } = createDto;

    // 0. Validar disponibilidad del restaurante y recepción de domicilios
    const estadoServicio = await this.obtenerEstadoServicio();
    if (!estadoServicio.activo) {
      throw new BadRequestException(
        `No es posible crear el pedido a domicilio: ${estadoServicio.motivo}`,
      );
    }

    // 1. Validar productos en catálogo, disponibilidad y existencias
    const productIds = items.map((i) => i.id_producto);
    const productos = await this.prisma.producto.findMany({
      where: { id_producto: { in: productIds } },
    });

    const productMap = new Map(productos.map((p) => [p.id_producto, p]));

    for (const item of items) {
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
      if (prod.controla_inventario && (prod.cantidad_inventario ?? 0) < item.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.cantidad_inventario}, solicitado: ${item.cantidad}.`,
        );
      }
    }

    // 2. Transacción atómica: cliente, stock, consecutivo y comanda
    return this.prisma.$transaction(async (tx) => {
      // 2.1 Buscar o registrar cliente por teléfono
      const telefonoLimpio = clienteDto.telefono.trim();
      let cliente = await tx.cliente.findFirst({
        where: { telefono: telefonoLimpio },
      });

      if (cliente) {
        // Actualizar datos si cambiaron de nombre o dirección
        cliente = await tx.cliente.update({
          where: { id_cliente: cliente.id_cliente },
          data: {
            nombre: clienteDto.nombre.trim(),
            direccion: clienteDto.direccion.trim(),
          },
        });
      } else {
        cliente = await tx.cliente.create({
          data: {
            nombre: clienteDto.nombre.trim(),
            telefono: telefonoLimpio,
            direccion: clienteDto.direccion.trim(),
          },
        });
      }

      // 2.2 Descontar stock para productos controlados
      for (const item of items) {
        const prod = productMap.get(item.id_producto)!;
        if (prod.controla_inventario) {
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

      // 2.3 Calcular consecutivo diario (zona horaria Colombia UTC-5)
      const ahora = new Date();
      const fechaColStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(ahora);

      const inicioDia = new Date(`${fechaColStr}T00:00:00-05:00`);
      const finDia = new Date(`${fechaColStr}T23:59:59.999-05:00`);

      const ultimoPedido = await tx.pedido.findFirst({
        where: {
          fecha_hora: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        orderBy: { numero_pedido: 'desc' },
        select: { numero_pedido: true },
      });

      const numero_pedido = (ultimoPedido?.numero_pedido ?? 0) + 1;

      // 2.4 Crear pedido de tipo domicilio con marca [PENDIENTE] y forma de pago
      const etiquetaPago = metodo_pago ? `[PAGO: ${metodo_pago.trim()}]` : '';
      const obsLimpia = observacion ? observacion.trim() : '';
      let observacionConPendiente = ['[PENDIENTE]', etiquetaPago, obsLimpia]
        .filter(Boolean)
        .join(' ');
      if (observacionConPendiente.length > 255) {
        observacionConPendiente = observacionConPendiente.slice(0, 255);
      }

      const pedidoCreado = await tx.pedido.create({
        data: {
          numero_pedido,
          tipo: TipoPedido.domicilio,
          estado: EstadoPedido.enviada,
          id_usuario,
          id_cliente: cliente.id_cliente,
          observacion: observacionConPendiente,
          items: {
            create: items.map((it) => {
              const prod = productMap.get(it.id_producto)!;
              return {
                id_producto: it.id_producto,
                cantidad: it.cantidad,
                precio_unitario: prod.precio_venta,
                ingredientes_removidos: it.ingredientes_removidos || null,
                observacion: it.observacion ? it.observacion.trim() : null,
              };
            }),
          },
        },
        include: this.domicilioInclude,
      });

      return this.mapearEtapaOperativa(pedidoCreado);
    });
  }

  /**
   * Consulta pedidos a domicilio con filtros opcionales de estado, fecha, búsqueda o usuario.
   */
  async obtenerTodos(filtros?: {
    estado?: string;
    fecha?: string;
    buscar?: string;
    id_usuario?: number;
  }) {
    const where: any = {
      tipo: TipoPedido.domicilio,
    };

    if (filtros?.id_usuario) {
      where.id_usuario = Number(filtros.id_usuario);
    }

    if (filtros?.fecha) {
      const fechaInicio = new Date(`${filtros.fecha}T00:00:00-05:00`);
      const fechaFin = new Date(`${filtros.fecha}T23:59:59.999-05:00`);
      where.fecha_hora = {
        gte: fechaInicio,
        lte: fechaFin,
      };
    }

    if (filtros?.buscar && filtros.buscar.trim()) {
      const q = filtros.buscar.trim();
      where.cliente = {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { telefono: { contains: q, mode: 'insensitive' } },
          { direccion: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    // Filtrado por etapa operativa
    if (filtros?.estado && filtros.estado !== 'Todos') {
      if (filtros.estado === 'Pendiente') {
        where.estado = EstadoPedido.enviada;
        where.observacion = {
          contains: '[PENDIENTE]',
        };
      } else if (filtros.estado === 'En Preparación') {
        where.estado = EstadoPedido.enviada;
        where.observacion = {
          not: { contains: '[EN REPARTO]' },
        };
        where.AND = [
          {
            OR: [
              { observacion: null },
              { observacion: { not: { contains: '[PENDIENTE]' } } },
            ],
          },
        ];
      } else if (filtros.estado === 'En Reparto') {
        where.estado = EstadoPedido.enviada;
        where.observacion = {
          contains: '[EN REPARTO]',
        };
      } else if (filtros.estado === 'Entregado') {
        where.estado = EstadoPedido.cerrada;
      } else if (filtros.estado === 'Historial') {
        where.estado = { in: [EstadoPedido.cerrada, EstadoPedido.cancelada] };
      } else if (filtros.estado === 'Cancelado') {
        where.estado = EstadoPedido.cancelada;
      }
    }

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: this.domicilioInclude,
      orderBy: { fecha_hora: 'desc' },
    });

    return pedidos.map((p) => this.mapearEtapaOperativa(p));
  }

  /**
   * Consulta los pedidos propios del cliente autenticado.
   */
  async obtenerMisPedidos(id_usuario: number) {
    return this.obtenerTodos({ id_usuario });
  }

  /**
   * Consulta el detalle de un pedido a domicilio por su ID.
   */
  async obtenerPorId(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: id },
      include: this.domicilioInclude,
    });

    if (!pedido || pedido.tipo !== TipoPedido.domicilio) {
      throw new NotFoundException(`Pedido a domicilio #${id} no fue encontrado.`);
    }

    return this.mapearEtapaOperativa(pedido);
  }

  /**
   * Busca clientes registrados por teléfono o nombre para autocompletar en el formulario.
   */
  async buscarClientes(query: string) {
    if (!query || query.trim().length === 0) {
      return this.prisma.cliente.findMany({
        take: 10,
        orderBy: { id_cliente: 'desc' },
      });
    }

    const q = query.trim();
    return this.prisma.cliente.findMany({
      where: {
        OR: [
          { telefono: { contains: q, mode: 'insensitive' } },
          { nombre: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Modifica la etapa operativa de un domicilio (aceptar/enviar a cocina, despachar a reparto con repartidor, cerrar/entregar o cancelar).
   */
  async cambiarEstado(id: number, dto: CambiarEstadoDomicilioDto) {
    const pedido = await this.obtenerPorId(id);

    if (
      pedido.estado !== EstadoPedido.enviada &&
      dto.estado !== 'Cancelado' &&
      dto.estado !== 'Rechazar'
    ) {
      throw new BadRequestException(
        `No se puede cambiar el estado de un pedido que ya está en estado '${pedido.estado}'.`,
      );
    }

    if (dto.estado === 'Cancelado' || dto.estado === 'Rechazar') {
      return this.cancelar(id, dto.motivo);
    }

    if (dto.estado === 'Entregado' || dto.estado === 'Cerrar') {
      const cerrado = await this.prisma.pedido.update({
        where: { id_pedido: id },
        data: {
          estado: EstadoPedido.cerrada,
        },
        include: this.domicilioInclude,
      });
      return this.mapearEtapaOperativa(cerrado);
    }

    let observacionActualizada = pedido.observacion || '';

    // Limpiar tags previos
    observacionActualizada = observacionActualizada
      .replace(/\[PENDIENTE\]/gi, '')
      .replace(/\[EN REPARTO\]/gi, '')
      .replace(/\[REPARTIDOR:[^\]]+\]/gi, '')
      .trim();

    if (dto.estado === 'En Reparto') {
      const tagRepartidor = dto.repartidor_nombre
        ? `[REPARTIDOR: ${dto.repartidor_nombre.trim()} | TEL: ${dto.repartidor_telefono?.trim() || 'N/A'}] `
        : '';
      observacionActualizada = `[EN REPARTO] ${tagRepartidor}${observacionActualizada}`.trim();
    } else if (dto.estado === 'En Preparación' || dto.estado === 'Aceptar') {
      // Al aceptar, se remueve [PENDIENTE] y queda limpio para preparación y cocina
      observacionActualizada = observacionActualizada.trim();
    }

    if (observacionActualizada.length > 255) {
      observacionActualizada = observacionActualizada.slice(0, 255);
    }

    const actualizado = await this.prisma.pedido.update({
      where: { id_pedido: id },
      data: {
        observacion: observacionActualizada || null,
      },
      include: this.domicilioInclude,
    });

    return this.mapearEtapaOperativa(actualizado);
  }

  /**
   * Cancela una comanda a domicilio, devuelve existencias a inventario y marca el pedido como cancelado.
   */
  async cancelar(id: number, motivo?: string) {
    const pedido = await this.obtenerPorId(id);

    if (pedido.estado !== EstadoPedido.enviada) {
      throw new BadRequestException(
        `No se puede cancelar el pedido #${id} porque su estado actual es '${pedido.estado}'. Solo se pueden cancelar pedidos activos.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Revertir inventario de productos controlados
      for (const item of (pedido.items || [])) {
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

      // 2. Marcar comanda como cancelada
      const notaCancelado = motivo ? `[CANCELADO: ${motivo}]` : '[CANCELADO]';
      const observacionLimpia = (pedido.observacion || '')
        .replace(/\[PENDIENTE\]/gi, '')
        .replace(/\[EN REPARTO\]/gi, '')
        .trim();
      let observacionFinal = `${notaCancelado} ${observacionLimpia}`.trim();
      if (observacionFinal.length > 255) {
        observacionFinal = observacionFinal.slice(0, 255);
      }

      const pedidoCancelado = await tx.pedido.update({
        where: { id_pedido: id },
        data: {
          estado: EstadoPedido.cancelada,
          observacion: observacionFinal,
        },
        include: this.domicilioInclude,
      });

      return this.mapearEtapaOperativa(pedidoCancelado);
    });
  }

  /**
   * Enriquecimiento reactivo: determina la etapa operativa del pedido para UI
   */
  private mapearEtapaOperativa(pedido: any) {
    let etapaOperativa:
      | 'Pendiente'
      | 'En Preparación'
      | 'En Reparto'
      | 'Entregado'
      | 'Cancelado' = 'Pendiente';

    if (pedido.estado === EstadoPedido.cerrada) {
      etapaOperativa = 'Entregado';
    } else if (pedido.estado === EstadoPedido.cancelada) {
      etapaOperativa = 'Cancelado';
    } else if (
      pedido.estado === EstadoPedido.enviada &&
      pedido.observacion?.includes('[EN REPARTO]')
    ) {
      etapaOperativa = 'En Reparto';
    } else if (
      pedido.estado === EstadoPedido.enviada &&
      pedido.observacion?.includes('[PENDIENTE]')
    ) {
      etapaOperativa = 'Pendiente';
    } else {
      etapaOperativa = 'En Preparación';
    }

    let repartidor: { nombre: string; telefono: string } | null = null;
    if (pedido.observacion) {
      const match = pedido.observacion.match(
        /\[REPARTIDOR:\s*([^|\]]+?)(?:\s*\|\s*TEL:\s*([^\]]+))?\]/i,
      );
      if (match) {
        repartidor = {
          nombre: match[1]?.trim() || '',
          telefono: match[2]?.trim() || '',
        };
      }
    }

    let metodo_pago = 'Efectivo';
    if (pedido.factura?.pagos && pedido.factura.pagos.length > 0) {
      metodo_pago = pedido.factura.pagos[0].medio_pago;
    } else if (pedido.observacion) {
      const matchPago = pedido.observacion.match(/\[PAGO:\s*([^\]]+)\]/i);
      if (matchPago) {
        metodo_pago = matchPago[1].trim();
      }
    }

    const observacionLimpia = (pedido.observacion || '')
      .replace(/\[PENDIENTE\]/gi, '')
      .replace(/\[EN REPARTO\]/gi, '')
      .replace(/\[REPARTIDOR:[^\]]*\]/gi, '')
      .replace(/\[PAGO:[^\]]*\]/gi, '')
      .trim();

    const totalCalculado = (pedido.items || []).reduce(
      (acc: number, it: any) => acc + it.cantidad * Number(it.precio_unitario),
      0,
    );

    return {
      ...pedido,
      observacion: observacionLimpia || null,
      observacion_raw: pedido.observacion,
      etapaOperativa,
      repartidor,
      metodo_pago,
      totalCalculado,
    };
  }
}
