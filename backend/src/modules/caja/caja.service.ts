import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCaja, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbrirCajaDto, CerrarCajaDto, CreateGastoDto } from './dto';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asegura que existan los medios de pago y tipos de gasto básicos en la BD.
   */
  async asegurarCatalogosBase(): Promise<void> {
    const mediosBase = ['Efectivo', 'Tarjeta', 'Transferencia'];
    for (const nombre of mediosBase) {
      await this.prisma.medioPago.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
    }

    const tiposGastoBase = ['Insumos', 'Aseo', 'Servicios', 'Otros'];
    for (const nombre of tiposGastoBase) {
      await this.prisma.tipoGasto.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
    }
  }

  /**
   * Abre un nuevo turno de caja en el restaurante con una base inicial.
   * Regla de negocio: Solo puede haber 1 caja abierta a la vez.
   */
  async abrirCaja(dto: AbrirCajaDto, id_usuario: number) {
    await this.asegurarCatalogosBase();

    const cajaAbierta = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
    });

    if (cajaAbierta) {
      throw new ConflictException(
        `Ya existe un turno de caja abierto (Turno #${cajaAbierta.id_caja}) iniciado el ${cajaAbierta.fecha_apertura.toLocaleDateString()}.`,
      );
    }

    return this.prisma.caja.create({
      data: {
        id_usuario_apertura: id_usuario,
        valor_inicial: new Prisma.Decimal(dto.valor_inicial),
        estado: EstadoCaja.abierta,
      },
      include: {
        usuarioApertura: {
          select: { id_usuario: true, nombre: true, rol: true },
        },
      },
    });
  }

  /**
   * Consulta el estado del turno actual (si está abierto, sus métricas consolidadas y movimientos).
   */
  async obtenerEstadoActual() {
    await this.asegurarCatalogosBase();

    const caja = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
      include: {
        usuarioApertura: {
          select: { id_usuario: true, nombre: true, rol: true },
        },
        facturas: {
          include: {
            mesa: true,
            usuario: { select: { id_usuario: true, nombre: true } },
            pagos: {
              include: { medioPago: true },
            },
          },
          orderBy: { fecha_hora: 'desc' },
        },
        gastos: {
          include: {
            tipoGasto: true,
            medioPago: true,
            usuario: { select: { id_usuario: true, nombre: true } },
          },
          orderBy: { fecha_hora: 'desc' },
        },
      },
    });

    if (!caja) {
      return {
        abierta: false,
        caja: null,
        resumen: null,
        movimientos: [],
      };
    }

    const valorBase = Number(caja.valor_inicial);

    // Calcular ventas por medio de pago
    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    let ventasTransferencia = 0;
    let totalVentas = 0;
    let totalPropinas = 0;

    for (const f of caja.facturas) {
      totalVentas += Number(f.valor_total);
      totalPropinas += Number(f.propina);

      for (const p of f.pagos) {
        const metodo = p.medioPago?.nombre?.toLowerCase() || '';
        const monto = Number(p.monto);
        if (metodo.includes('efectivo')) {
          ventasEfectivo += monto;
        } else if (metodo.includes('tarjeta')) {
          ventasTarjeta += monto;
        } else {
          ventasTransferencia += monto;
        }
      }
    }

    // Calcular gastos
    let totalGastos = 0;
    let gastosEfectivo = 0;
    const desgloseGastos: Record<string, number> = {};

    for (const g of caja.gastos) {
      const monto = Number(g.total);
      totalGastos += monto;

      const metodo = g.medioPago?.nombre?.toLowerCase() || '';
      if (metodo.includes('efectivo') || metodo === '') {
        gastosEfectivo += monto;
      }

      const tipo = g.tipoGasto?.nombre || 'Otros';
      desgloseGastos[tipo] = (desgloseGastos[tipo] || 0) + monto;
    }

    // Efectivo esperado en cajón: Base + Ventas en Efectivo - Gastos en Efectivo
    const efectivoEsperado = valorBase + ventasEfectivo - gastosEfectivo;

    // Consolidar lista cronológica de movimientos
    const movimientos = [
      ...caja.facturas.map((f) => ({
        id: `factura-${f.id_venta}`,
        hora: f.fecha_hora,
        descripcion: f.id_mesa ? `Pago Mesa #${f.mesa?.numero}` : 'Venta Directa / Barra',
        tipo: 'Ingreso' as const,
        monto: Number(f.valor_total),
        medio_pago: f.pagos.map((p) => p.medioPago?.nombre).join(', ') || 'Efectivo',
        responsable: f.usuario?.nombre || 'Cajero',
      })),
      ...caja.gastos.map((g) => ({
        id: `gasto-${g.id_gasto}`,
        hora: g.fecha_hora,
        descripcion: `${g.descripcion} (${g.tipoGasto?.nombre})`,
        tipo: 'Gasto' as const,
        monto: -Number(g.total),
        medio_pago: g.medioPago?.nombre || 'Efectivo',
        responsable: g.usuario?.nombre || 'Cajero',
      })),
    ].sort((a, b) => new Date(b.hora).getTime() - new Date(a.hora).getTime());

    return {
      abierta: true,
      caja: {
        id_caja: caja.id_caja,
        fecha_apertura: caja.fecha_apertura,
        valor_inicial: valorBase,
        usuario_apertura: caja.usuarioApertura.nombre,
      },
      resumen: {
        valor_base: valorBase,
        total_ventas: totalVentas,
        total_propinas: totalPropinas,
        total_transacciones: caja.facturas.length,
        ventas_efectivo: ventasEfectivo,
        ventas_tarjeta: ventasTarjeta,
        ventas_transferencia: ventasTransferencia,
        total_gastos: totalGastos,
        gastos_efectivo: gastosEfectivo,
        desglose_gastos: desgloseGastos,
        total_movimientos_gasto: caja.gastos.length,
        efectivo_esperado: efectivoEsperado,
      },
      movimientos,
    };
  }

  /**
   * Registra una salida menor de dinero (gasto) en la caja abierta del turno.
   */
  async registrarGasto(dto: CreateGastoDto, id_usuario: number) {
    await this.asegurarCatalogosBase();

    const caja = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
    });

    if (!caja) {
      throw new BadRequestException('No hay un turno de caja abierto para registrar gastos.');
    }

    // Resolver TipoGasto
    let tipoGasto = await this.prisma.tipoGasto.findUnique({
      where: { nombre: dto.tipo_gasto },
    });
    if (!tipoGasto) {
      tipoGasto = await this.prisma.tipoGasto.create({
        data: { nombre: dto.tipo_gasto },
      });
    }

    // Resolver MedioPago (por defecto Efectivo)
    const nombreMedio = dto.medio_pago || 'Efectivo';
    let medioPago = await this.prisma.medioPago.findUnique({
      where: { nombre: nombreMedio },
    });
    if (!medioPago) {
      medioPago = await this.prisma.medioPago.create({
        data: { nombre: nombreMedio },
      });
    }

    return this.prisma.gasto.create({
      data: {
        id_caja: caja.id_caja,
        id_usuario,
        id_tipo_gasto: tipoGasto.id_tipo_gasto,
        id_medio_pago: medioPago.id_medio_pago,
        total: new Prisma.Decimal(dto.total),
        descripcion: dto.descripcion,
        observacion: dto.observacion,
      },
      include: {
        tipoGasto: true,
        medioPago: true,
      },
    });
  }

  /**
   * Realiza el arqueo y cierre del turno de caja comparando teórico vs físico.
   */
  async cerrarCaja(dto: CerrarCajaDto, id_usuario: number) {
    const estadoActual = await this.obtenerEstadoActual();

    if (!estadoActual.abierta || !estadoActual.caja || !estadoActual.resumen) {
      throw new BadRequestException('No hay ninguna caja abierta en el sistema para realizar arqueo.');
    }

    const valorTeorico = estadoActual.resumen.efectivo_esperado;
    const valorFisico = dto.valor_final_fisico;
    const diferencia = valorFisico - valorTeorico;

    const cajaCerrada = await this.prisma.caja.update({
      where: { id_caja: estadoActual.caja.id_caja },
      data: {
        id_usuario_cierre: id_usuario,
        fecha_cierre: new Date(),
        valor_final_teorico: new Prisma.Decimal(valorTeorico),
        valor_final_fisico: new Prisma.Decimal(valorFisico),
        diferencia: new Prisma.Decimal(diferencia),
        estado: EstadoCaja.cerrada,
      },
      include: {
        usuarioApertura: { select: { nombre: true } },
        usuarioCierre: { select: { nombre: true } },
      },
    });

    return {
      exito: true,
      caja_id: cajaCerrada.id_caja,
      fecha_apertura: cajaCerrada.fecha_apertura,
      fecha_cierre: cajaCerrada.fecha_cierre,
      valor_inicial: Number(cajaCerrada.valor_inicial),
      total_ventas: estadoActual.resumen.total_ventas,
      total_gastos: estadoActual.resumen.total_gastos,
      valor_final_teorico: valorTeorico,
      valor_final_fisico: valorFisico,
      diferencia,
      tipo_cuadre: diferencia === 0 ? 'exacto' : diferencia > 0 ? 'sobrante' : 'faltante',
      cajero_cierre: cajaCerrada.usuarioCierre?.nombre || 'Cajero',
    };
  }

  /**
   * Obtiene el histórico de turnos de caja cerrados.
   */
  async obtenerHistorial(limite = 15) {
    return this.prisma.caja.findMany({
      where: { estado: EstadoCaja.cerrada },
      orderBy: { fecha_cierre: 'desc' },
      take: limite,
      include: {
        usuarioApertura: { select: { nombre: true } },
        usuarioCierre: { select: { nombre: true } },
        _count: {
          select: { facturas: true, gastos: true },
        },
      },
    });
  }
}
