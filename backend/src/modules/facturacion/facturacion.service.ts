import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCaja,
  EstadoFactura,
  EstadoMesa,
  EstadoPedido,
  Prisma,
  RolUsuario,
  TipoPedido,
} from '@prisma/client';
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
    let clienteNombreFinal = dto.cliente_nombre;
    let clienteEmailFinal = dto.cliente_email;

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
      clienteNombreFinal = clienteNombreFinal || pedido.cliente_nombre || undefined;
      clienteEmailFinal = clienteEmailFinal || pedido.cliente_email || undefined;

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
          cliente_nombre: clienteNombreFinal || null,
          cliente_email: clienteEmailFinal || null,
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
        { cliente_nombre: { contains: q, mode: 'insensitive' } },
        { cliente_email: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.factura.findMany({
      where,
      orderBy: { fecha_hora: 'desc' },
      include: {
        mesa: true,
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
   * Modifica una facturación existente (ítems/productos, propina, medios de pago, observaciones).
   * Si se editan los ítems:
   *  1. Ajusta automáticamente las existencias de inventario de los productos modificados/agregados/removidos.
   *  2. Recalcula el subtotal y el total exacto de la factura.
   *  3. Reasigna los pagos para que sumen el nuevo total (o redistribuye el pago).
   *  4. El arqueo de la caja activa se recalcula dinámicamente con total consistencia contable.
   *  5. Deja sello de trazabilidad y auditoría.
   */
  async actualizarFactura(id: number, dto: UpdateFacturaDto, usuarioAuth?: any) {
    const facturaExistente = await this.prisma.factura.findUnique({
      where: { id_venta: id },
      include: {
        caja: true,
        pagos: { include: { medioPago: true } },
        pedidos: {
          include: {
            items: { include: { producto: true } },
          },
        },
      },
    });

    if (!facturaExistente) {
      throw new NotFoundException(`La factura #${id} no existe.`);
    }

    if (facturaExistente.estado === EstadoFactura.anulada) {
      throw new BadRequestException('No es posible modificar una factura que ya ha sido anulada.');
    }

    // Si la caja ya fue cerrada, solo un administrador con privilegios puede ajustar
    if (facturaExistente.caja.estado === EstadoCaja.cerrada && usuarioAuth?.rol !== RolUsuario.administrador) {
      throw new BadRequestException(
        'Esta factura pertenece a un turno de caja que ya fue cerrado y arqueado. Solo un Administrador puede realizar correcciones retroactivas.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let nuevoSubtotal = Number(facturaExistente.valor);
      const itemsActualizados = dto.items !== undefined;

      // 1. Si se actualizan los ítems/productos
      if (itemsActualizados) {
        // Encontrar el pedido primario o el primer pedido asociado
        let pedidoDestino: any = facturaExistente.pedidos[0];
        if (!pedidoDestino) {
          pedidoDestino = await tx.pedido.create({
            data: {
              numero_pedido: id,
              tipo: facturaExistente.id_mesa ? TipoPedido.salon : TipoPedido.domicilio,
              estado: EstadoPedido.cerrada,
              id_usuario: facturaExistente.id_usuario,
              id_factura: id,
              id_mesa: facturaExistente.id_mesa,
            },
          });
        }

        // Obtener inventario actual de los items de la factura
        const itemsAnteriores = facturaExistente.pedidos.flatMap((p) => p.items || []);
        const stockPrevioMap = new Map<number, number>();
        for (const it of itemsAnteriores) {
          stockPrevioMap.set(it.id_producto, (stockPrevioMap.get(it.id_producto) || 0) + it.cantidad);
        }

        const stockNuevoMap = new Map<number, number>();
        for (const it of dto.items || []) {
          stockNuevoMap.set(it.id_producto, (stockNuevoMap.get(it.id_producto) || 0) + it.cantidad);
        }

        // Determinar todos los productos involucrados
        const todosProductosIds = Array.from(
          new Set([...Array.from(stockPrevioMap.keys()), ...Array.from(stockNuevoMap.keys())]),
        );

        const productosDb = await tx.producto.findMany({
          where: { id_producto: { in: todosProductosIds } },
        });
        const productoMap = new Map(productosDb.map((p) => [p.id_producto, p]));

        // Ajustar existencias en inventario
        for (const prodId of todosProductosIds) {
          const prod = productoMap.get(prodId);
          if (prod && prod.controla_inventario) {
            const cantPrevia = stockPrevioMap.get(prodId) || 0;
            const cantNueva = stockNuevoMap.get(prodId) || 0;
            const delta = cantNueva - cantPrevia; // Si delta > 0 se consumieron más; si delta < 0 se devuelven

            if (delta > 0) {
              if (prod.cantidad_inventario < delta) {
                throw new BadRequestException(
                  `Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.cantidad_inventario}, requerido adicional: ${delta}.`,
                );
              }
              await tx.producto.update({
                where: { id_producto: prodId },
                data: { cantidad_inventario: { decrement: delta } },
              });
            } else if (delta < 0) {
              await tx.producto.update({
                where: { id_producto: prodId },
                data: { cantidad_inventario: { increment: Math.abs(delta) } },
              });
            }
          }
        }

        // Eliminar los items anteriores de los pedidos de esta factura
        const pedidosIds = facturaExistente.pedidos.map((p) => p.id_pedido);
        if (pedidosIds.length > 0) {
          await tx.itemPedido.deleteMany({
            where: { id_pedido: { in: pedidosIds } },
          });
        }

        // Insertar los nuevos items calculando subtotales
        nuevoSubtotal = 0;
        for (const it of dto.items || []) {
          const prod = productoMap.get(it.id_producto);
          if (!prod) {
            throw new NotFoundException(`El producto #${it.id_producto} no fue encontrado.`);
          }
          const precioUnit = it.precio_unitario !== undefined ? Number(it.precio_unitario) : Number(prod.precio_venta);
          nuevoSubtotal += it.cantidad * precioUnit;

          await tx.itemPedido.create({
            data: {
              id_pedido: pedidoDestino.id_pedido,
              id_producto: it.id_producto,
              cantidad: it.cantidad,
              precio_unitario: new Prisma.Decimal(precioUnit),
              observacion: it.observacion ? it.observacion.trim().slice(0, 255) : null,
            },
          });
        }
      }

      // 2. Calcular propina y valor total
      const propinaFinal = dto.propina !== undefined ? Number(dto.propina) : Number(facturaExistente.propina);
      const nuevoTotal = Math.max(0, nuevoSubtotal + propinaFinal);

      // 3. Reasignar medios de pago
      if (dto.pagos && dto.pagos.length > 0) {
        await tx.pago.deleteMany({ where: { id_venta: id } });

        let totalPagosDto = dto.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
        if (dto.pagos.length === 1 && Math.abs(totalPagosDto - nuevoTotal) > 0.01) {
          dto.pagos[0].monto = nuevoTotal;
          totalPagosDto = nuevoTotal;
        }

        for (const p of dto.pagos) {
          let medio = await tx.medioPago.findUnique({
            where: { nombre: p.medio_pago },
          });
          if (!medio) {
            medio = await tx.medioPago.create({ data: { nombre: p.medio_pago } });
          }

          await tx.pago.create({
            data: {
              id_venta: id,
              id_medio_pago: medio.id_medio_pago,
              monto: new Prisma.Decimal(p.monto),
            },
          });
        }
      } else if (itemsActualizados || dto.propina !== undefined) {
        const pagosExistentes = facturaExistente.pagos || [];
        if (pagosExistentes.length === 1) {
          await tx.pago.update({
            where: { id_pago: pagosExistentes[0].id_pago },
            data: { monto: new Prisma.Decimal(nuevoTotal) },
          });
        } else if (pagosExistentes.length > 1) {
          const totalOtros = pagosExistentes.slice(1).reduce((acc, p) => acc + Number(p.monto), 0);
          const primerPagoMonto = Math.max(0, nuevoTotal - totalOtros);
          await tx.pago.update({
            where: { id_pago: pagosExistentes[0].id_pago },
            data: { monto: new Prisma.Decimal(primerPagoMonto) },
          });
        }
      }

      // 4. Registro de auditoría
      const diffTotal = nuevoTotal - Number(facturaExistente.valor_total);
      const diffSigno = diffTotal >= 0 ? `+$${diffTotal.toLocaleString('es-CO')}` : `-$${Math.abs(diffTotal).toLocaleString('es-CO')}`;
      const usuarioNombre = usuarioAuth?.nombre || 'Personal';
      const motivoTexto = dto.motivo_edicion ? ` | Motivo: ${dto.motivo_edicion.trim()}` : '';

      const fechaHoraAudit = new Date().toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const notaAuditoria = `[EDITADA por ${usuarioNombre} ${fechaHoraAudit}: Total previo $${Number(facturaExistente.valor_total).toLocaleString('es-CO')} -> $${nuevoTotal.toLocaleString('es-CO')} (${diffSigno})${motivoTexto}]`;

      const obsBase = dto.observacion !== undefined
        ? (dto.observacion ? dto.observacion.trim() : '')
        : (facturaExistente.observacion || '');

      let observacionFinal = [obsBase, notaAuditoria].filter(Boolean).join(' ').trim();
      if (observacionFinal.length > 255) {
        observacionFinal = observacionFinal.slice(0, 255);
      }

      // 5. Actualizar la Factura en base de datos
      await tx.factura.update({
        where: { id_venta: id },
        data: {
          valor: new Prisma.Decimal(nuevoSubtotal),
          propina: new Prisma.Decimal(propinaFinal),
          valor_total: new Prisma.Decimal(nuevoTotal),
          observacion: observacionFinal || null,
        },
      });

      return tx.factura.findUnique({
        where: { id_venta: id },
        include: {
          mesa: true,
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
