import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCaja, EstadoMesa, EstadoPedido, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFacturaDto } from './dto';

@Injectable()
export class FacturacionService {
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

    // 2. Si es una mesa, buscar los pedidos activos
    let subtotal = 0;
    let pedidosActivos: any[] = [];

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
    } else {
      // Venta directa sin mesa: el subtotal se toma del pago total
      subtotal = dto.pagos.reduce((acc, p) => acc + p.monto, 0);
    }

    const propina = dto.propina || 0;
    const valorTotal = subtotal + propina;

    // 3. Validar que la suma de los pagos cubra el total
    const totalPagado = dto.pagos.reduce((acc, p) => acc + p.monto, 0);
    if (totalPagado < valorTotal) {
      throw new BadRequestException(
        `El monto pagado ($${totalPagado.toLocaleString()}) no cubre el valor total ($${valorTotal.toLocaleString()}).`,
      );
    }

    // 4. Transacción atómica: Factura + Pagos + Actualización de pedidos y mesa
    return this.prisma.$transaction(async (tx) => {
      // Crear la Factura
      const factura = await tx.factura.create({
        data: {
          id_caja: cajaActiva.id_caja,
          id_usuario,
          id_mesa: dto.id_mesa || null,
          id_cliente: dto.id_cliente || null,
          valor: new Prisma.Decimal(subtotal),
          propina: new Prisma.Decimal(propina),
          valor_total: new Prisma.Decimal(valorTotal),
          observacion: dto.observacion,
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

      // Marcar los pedidos de la mesa como cerrados y asociarlos a la factura
      if (pedidosActivos.length > 0) {
        await tx.pedido.updateMany({
          where: {
            id_pedido: { in: pedidosActivos.map((p) => p.id_pedido) },
          },
          data: {
            id_factura: factura.id_venta,
            estado: EstadoPedido.cerrada,
          },
        });
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
}
