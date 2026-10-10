import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCaja, EstadoFactura, EstadoMesa, EstadoPedido, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFacturaDto, UpdateFacturaDto } from './dto';

@Injectable()
export class FacturacionService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera la factura de cobro, registra los pagos, asocia a la caja activa
   * del turno, cierra los pedidos y libera la mesa.
   */
  async crearFactura(dto: CreateFacturaDto, id_usuario: number) {
    // 1. Validar que exista una caja abierta en el restaurante
    const cajaActiva = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
    });

    if (!cajaActiva) {
      throw new BadRequestException(
        'No se puede procesar el cobro: No hay un turno de caja abierto. Por favor abra la caja antes de facturar.',
      );
    }

    // 2. Si es una mesa o un pedido específico (ej. domicilio), buscar los pedidos activos
    let subtotal = 0;
    let pedidosActivos: any[] = [];
    let idClienteFinal = dto.id_cliente;

    if (dto.id_mesa) {
      const mesa = await this.prisma.mesa.findUnique({
        where: { id_mesa: dto.id_mesa },
      });

      if (!mesa) {
        throw new NotFoundException(`La mesa #${dto.id_mesa} no existe.`);
      }

      pedidosActivos = await this.prisma.pedido.findMany({
        where: {
          id_mesa: dto.id_mesa,
          estado: EstadoPedido.enviada,
        },
        include: {
          items: true,
        },
      });

      if (pedidosActivos.length === 0) {
        throw new BadRequestException(
          `La mesa #${mesa.numero} no tiene pedidos activos pendientes de cobro.`,
        );
      }

      for (const ped of pedidosActivos) {
        for (const it of ped.items) {
          subtotal += it.cantidad * Number(it.precio_unitario);
        }
      }
    } else if (dto.id_pedido) {
      const pedido = await this.prisma.pedido.findUnique({
        where: { id_pedido: dto.id_pedido },
        include: {
          items: true,
          cliente: true,
        },
      });

      if (!pedido) {
        throw new NotFoundException(`El pedido #${dto.id_pedido} no existe.`);
      }

      // Si el pedido ya cuenta con una factura registrada, editar la misma en vez de crear duplicados
      if (pedido.id_factura) {
        return this.actualizarFactura(pedido.id_factura, {
          pagos: dto.pagos,
          propina: dto.propina,
          observacion: dto.observacion,
        });
      }

      if (pedido.estado !== EstadoPedido.enviada) {
        throw new BadRequestException(
          `El pedido #${dto.id_pedido} no puede ser cobrado porque se encuentra en estado '${pedido.estado}'.`,
        );
      }

      pedidosActivos = [pedido];
      idClienteFinal = idClienteFinal || pedido.id_cliente || undefined;

      for (const it of pedido.items) {
        subtotal += it.cantidad * Number(it.precio_unitario);
      }
    } else {
      // Venta directa sin mesa ni pedido: el subtotal se toma del pago total
      subtotal = dto.pagos.reduce((acc, p) => acc + p.monto, 0);
    }

    const propina = dto.propina || 0;
    const valorTotal = subtotal + propina;

    // 3. Validar que la suma de los pagos cubra el total
    let totalPagado = Math.round((dto.pagos.reduce((acc, p) => acc + p.monto, 0) + Number.EPSILON) * 100) / 100;
    if (totalPagado < valorTotal) {
      throw new BadRequestException(
        `El monto pagado ($${totalPagado.toLocaleString()}) no cubre el valor total ($${valorTotal.toLocaleString()}).`,
      );
    }

    // Regla contable: Si el pago fue en efectivo con billete de mayor denominación (se dio cambio/vueltos físico),
    // el monto a asentar contablemente en el pago de caja es el valor total exacto de la factura.
    if (totalPagado > valorTotal && dto.pagos.length === 1 && dto.pagos[0].medio_pago.toLowerCase().includes('efectivo')) {
      dto.pagos[0].monto = valorTotal;
      totalPagado = valorTotal;
    }

    // 4. Transacción atómica: Factura + Pagos + Actualización de pedidos y mesa
    return this.prisma.$transaction(async (tx) => {
      // Crear la Factura
      const factura = await tx.factura.create({
        data: {
          id_caja: cajaActiva.id_caja,
          id_usuario,
          id_mesa: dto.id_mesa || null,
          id_cliente: idClienteFinal || null,
          valor: new Prisma.Decimal(subtotal),
          propina: new Prisma.Decimal(propina),
          valor_total: new Prisma.Decimal(valorTotal),
          observacion: dto.observacion ? dto.observacion.trim().slice(0, 255) : null,
        },
      });

      // Crear cada registro de Pago
      for (const p of dto.pagos) {
        let medio = await tx.medioPago.findUnique({
          where: { nombre: p.medio_pago },
        });

        if (!medio) {
          medio = await tx.medioPago.create({
            data: { nombre: p.medio_pago },
          });
        }

        await tx.pago.create({
          data: {
            id_venta: factura.id_venta,
            id_medio_pago: medio.id_medio_pago,
            monto: new Prisma.Decimal(p.monto),
          },
        });
      }

      // Marcar los pedidos como asociados a la factura
      if (pedidosActivos.length > 0) {
        if (dto.id_mesa) {
          // Si es salón, cerrar pedidos de la mesa
          await tx.pedido.updateMany({
            where: {
              id_pedido: { in: pedidosActivos.map((p) => p.id_pedido) },
            },
            data: {
              id_factura: factura.id_venta,
              estado: EstadoPedido.cerrada,
            },
          });
        } else {
          // Si es domicilio (o pedido específico), asociar factura sin cerrar comanda obligatoriamente
          await tx.pedido.updateMany({
            where: {
              id_pedido: { in: pedidosActivos.map((p) => p.id_pedido) },
            },
            data: {
              id_factura: factura.id_venta,
              ...(dto.cerrar_pedido ? { estado: EstadoPedido.cerrada } : {}),
            },
          });
        }
      }

      // Liberar la mesa
      if (dto.id_mesa) {
        await tx.mesa.update({
          where: { id_mesa: dto.id_mesa },
          data: { estado: EstadoMesa.libre },
        });
      }

      return tx.factura.findUnique({
        where: { id_venta: factura.id_venta },
        include: {
          mesa: true,
          usuario: { select: { nombre: true, rol: true } },
          pagos: { include: { medioPago: true } },
          caja: { select: { id_caja: true, fecha_apertura: true } },
        },
      });
    });
  }

  /**
   * Consulta el historial general de facturas con filtros opcionales (tipo, fecha, caja, búsqueda).
   */
  async obtenerTodas(filtros?: {
    tipo?: string;
    fecha?: string;
    buscar?: string;
    id_caja?: number;
    estado?: string;
  }) {
    const where: any = {};

    if (filtros?.id_caja) {
      where.id_caja = Number(filtros.id_caja);
    }

    if (filtros?.estado) {
      where.estado = filtros.estado as EstadoFactura;
    }

    if (filtros?.tipo === 'salon') {
      where.id_mesa = { not: null };
    } else if (filtros?.tipo === 'domicilio') {
      where.id_mesa = null;
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
      where.OR = [
        { observacion: { contains: q, mode: 'insensitive' } },
        { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
        { cliente: { telefono: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.factura.findMany({
      where,
      orderBy: { fecha_hora: 'desc' },
      include: {
        mesa: true,
        cliente: true,
        usuario: { select: { id_usuario: true, nombre: true, rol: true } },
        pagos: { include: { medioPago: true } },
        pedidos: {
          include: {
            items: { include: { producto: true } },
          },
        },
      },
    });
  }

  /**
   * Modifica una facturación existente (desglose de pagos, método de pago, propina u observación).
   * Al actualizar los pagos, el arqueo de caja se actualiza automáticamente.
   */
  async actualizarFactura(id: number, dto: UpdateFacturaDto) {
    const facturaExistente = await this.prisma.factura.findUnique({
      where: { id_venta: id },
      include: { pagos: true },
    });

    if (!facturaExistente) {
      throw new NotFoundException(`La factura #${id} no existe.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Si se actualizan los pagos, reasignar los medios de pago
      if (dto.pagos && dto.pagos.length > 0) {
        // Eliminar pagos antiguos
        await tx.pago.deleteMany({
          where: { id_venta: id },
        });

        // Crear los nuevos pagos
        for (const p of dto.pagos) {
          let medio = await tx.medioPago.findUnique({
            where: { nombre: p.medio_pago },
          });

          if (!medio) {
            medio = await tx.medioPago.create({
              data: { nombre: p.medio_pago },
            });
          }

          await tx.pago.create({
            data: {
              id_venta: id,
              id_medio_pago: medio.id_medio_pago,
              monto: new Prisma.Decimal(p.monto),
            },
          });
        }
      }

      // 2. Si se actualiza propina u observación
      const updateData: any = {};
      if (dto.observacion !== undefined) {
        updateData.observacion = dto.observacion ? dto.observacion.trim().slice(0, 255) : null;
      }
      if (dto.propina !== undefined) {
        updateData.propina = new Prisma.Decimal(dto.propina);
        updateData.valor_total = new Prisma.Decimal(
          Number(facturaExistente.valor) + Number(dto.propina),
        );
      }

      if (Object.keys(updateData).length > 0) {
        await tx.factura.update({
          where: { id_venta: id },
          data: updateData,
        });
      }

      return tx.factura.findUnique({
        where: { id_venta: id },
        include: {
          mesa: true,
          cliente: true,
          usuario: { select: { nombre: true, rol: true } },
          pagos: { include: { medioPago: true } },
          pedidos: {
            include: {
              items: { include: { producto: true } },
            },
          },
        },
      });
    });
  }

  /**
   * Consulta una factura por ID.
   */
  async obtenerPorId(id: number) {
    const factura = await this.prisma.factura.findUnique({
      where: { id_venta: id },
      include: {
        mesa: true,
        cliente: true,
        usuario: { select: { nombre: true } },
        pagos: { include: { medioPago: true } },
        pedidos: {
          include: {
            items: { include: { producto: true } },
          },
        },
      },
    });

    if (!factura) {
      throw new NotFoundException(`La factura #${id} no existe.`);
    }

    return factura;
  }

  /**
   * Anula formalmente una factura registrada sin eliminarla de la base de datos (cumplimiento contable/DIAN).
   * Deja la factura en estado 'anulada' para preservar la secuencia consecutiva,
   * excluye automáticamente sus importes del arqueo del turno y registra el motivo y responsable.
   */
  async anularFactura(id: number, motivo: string, id_usuario: number) {
    if (!motivo || motivo.trim().length === 0) {
      throw new BadRequestException('El motivo de anulación de la factura es obligatorio.');
    }

    const factura = await this.prisma.factura.findUnique({
      where: { id_venta: id },
      include: {
        caja: true,
        pagos: { include: { medioPago: true } },
      },
    });

    if (!factura) {
      throw new NotFoundException(`La factura #FAC-${id} no existe.`);
    }

    if (factura.estado === EstadoFactura.anulada) {
      throw new BadRequestException(`La factura #FAC-${id} ya se encuentra anulada.`);
    }

    // Regla de negocio: Solo se pueden anular facturas de turnos de caja activos
    if (factura.caja.estado !== EstadoCaja.abierta) {
      throw new BadRequestException(
        `No es posible anular la factura #FAC-${id}: El turno de caja #${factura.id_caja} ya fue cerrado y arqueado contablemente.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar la factura como anulada
      const facturaAnulada = await tx.factura.update({
        where: { id_venta: id },
        data: {
          estado: EstadoFactura.anulada,
          fecha_anulacion: new Date(),
          motivo_anulacion: motivo.trim().slice(0, 255),
        },
        include: {
          mesa: true,
          cliente: true,
          usuario: { select: { nombre: true, rol: true } },
          pagos: { include: { medioPago: true } },
        },
      });

      // 2. Si tenía pedidos asociados, restituir existencias en inventario y marcarlos como cancelados
      const pedidosAsociados = await tx.pedido.findMany({
        where: { id_factura: id },
        include: {
          items: {
            include: { producto: true },
          },
        },
      });

      for (const ped of pedidosAsociados) {
        for (const item of ped.items) {
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

      await tx.pedido.updateMany({
        where: { id_factura: id },
        data: { estado: EstadoPedido.cancelada },
      });

      this.logger.warn(
        `[SECURITY_AUDIT] Factura #FAC-${id} ANULADA por usuario #${id_usuario}. Motivo: ${motivo.trim()}`,
      );

      return {
        exito: true,
        mensaje: `Factura #FAC-${id} anulada exitosamente.`,
        factura: facturaAnulada,
      };
    });
  }

  /**
   * Elimina / anula una factura registrada en el turno de caja.
   * Por retrocompatibilidad, redirige a anularFactura.
   */
  async eliminarFactura(id: number) {
    return this.anularFactura(id, 'Eliminación solicitada por administración', 1);
  }
}
