import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCaja, EstadoFactura, EstadoPedido, Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizarMedioPago, redondearMoneda } from '../../common/utils/contabilidad.util';
import { FiltroRangoFecha, resolverRangoFechaOpcional } from '../../common/utils/date-range.util';
import { AbrirCajaDto, CerrarCajaDto, CreateGastoDto, UpdateGastoDto } from './dto';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  private catalogosAsegurados = false;

  /**
   * Asegura que existan los medios de pago y tipos de gasto básicos en la BD.
   * Optimización: cachea el estado para evitar 7 consultas upsert redundantes por cada sondeo.
   */
  async asegurarCatalogosBase(): Promise<void> {
    if (this.catalogosAsegurados) return;

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

    this.catalogosAsegurados = true;
  }

  /**
   * Abre un nuevo turno de caja en el restaurante con una base inicial.
   * Regla de negocio: Solo puede haber 1 caja abierta a la vez (serializado con bloqueo asesor).
   */
  async abrirCaja(dto: AbrirCajaDto, id_usuario: number) {
    if (dto.valor_inicial < 0) {
      throw new BadRequestException('El valor base inicial no puede ser negativo.');
    }

    await this.asegurarCatalogosBase();

    const ejecutarApertura = async (tx: any) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(730301)`;
      }

      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: EstadoCaja.abierta },
      });

      if (cajaAbierta) {
        throw new ConflictException(
          `Ya existe un turno de caja abierto (Turno #${cajaAbierta.id_caja}) iniciado el ${cajaAbierta.fecha_apertura.toLocaleDateString()}.`,
        );
      }

      return tx.caja.create({
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
    };

    return typeof this.prisma.$transaction === 'function'
      ? this.prisma.$transaction((tx) => ejecutarApertura(tx))
      : ejecutarApertura(this.prisma);
  }

  /**
   * Consulta el estado del turno actual (si está abierto, sus métricas consolidadas y movimientos).
   * Excluye estrictamente facturas anuladas para que el arqueo de caja físico no presente discrepancias.
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
            pedidos: {
              include: {
                items: {
                  include: {
                    producto: {
                      select: {
                        id_producto: true,
                        nombre: true,
                        costo: true,
                        precio_venta: true,
                      },
                    },
                  },
                },
              },
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

    const valorBase = redondearMoneda(Number(caja.valor_inicial));

    // Calcular ventas por medio de pago (excluyendo facturas anuladas)
    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    let ventasTransferencia = 0;
    let totalVentas = 0;
    let totalPropinas = 0;
    let transaccionesValidas = 0;
    let totalFacturasAnuladas = 0;
    let totalCostoInsumos = 0;

    for (const f of caja.facturas) {
      if (f.estado === EstadoFactura.anulada) {
        totalFacturasAnuladas++;
        continue; // NO sumar al dinero en caja ni a las ventas netas
      }

      transaccionesValidas++;
      totalVentas += Number(f.valor_total);
      totalPropinas += Number(f.propina);

      // Calcular costo estimado de insumos vendidos en pedidos de la factura
      if (Array.isArray((f as any).pedidos)) {
        for (const ped of (f as any).pedidos) {
          if (Array.isArray(ped.items)) {
            for (const it of ped.items) {
              const cant = Number(it.cantidad) || 0;
              const costo = Number(it.producto?.costo) || 0;
              totalCostoInsumos += cant * costo;
            }
          }
        }
      }

      for (const p of f.pagos) {
        const metodo = normalizarMedioPago(p.medioPago?.nombre);
        const monto = Number(p.monto);
        if (metodo === 'efectivo') {
          ventasEfectivo += monto;
        } else if (metodo === 'tarjeta') {
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

      const metodo = normalizarMedioPago(g.medioPago?.nombre);
      if (metodo === 'efectivo' || !g.medioPago) {
        gastosEfectivo += monto;
      }

      const tipo = g.tipoGasto?.nombre || 'Otros';
      desgloseGastos[tipo] = redondearMoneda((desgloseGastos[tipo] || 0) + monto);
    }

    // Redondear todos los acumulados contables
    ventasEfectivo = redondearMoneda(ventasEfectivo);
    ventasTarjeta = redondearMoneda(ventasTarjeta);
    ventasTransferencia = redondearMoneda(ventasTransferencia);
    totalVentas = redondearMoneda(totalVentas);
    totalPropinas = redondearMoneda(totalPropinas);
    totalGastos = redondearMoneda(totalGastos);
    gastosEfectivo = redondearMoneda(gastosEfectivo);
    totalCostoInsumos = redondearMoneda(totalCostoInsumos);

    const ventasNetas = redondearMoneda(totalVentas - totalPropinas);

    // Utilidades del día (Ganancia real del turno):
    // Ganancia = Ventas Netas (sin propinas) - Costo de Preparación/Insumos de Productos Vendidos - Gastos Registrados en Caja
    const utilidadOperativa = redondearMoneda(ventasNetas - totalGastos);
    const utilidadNeta = redondearMoneda(ventasNetas - totalCostoInsumos - totalGastos);
    const margenUtilidadPorcentaje = ventasNetas > 0 ? redondearMoneda((utilidadNeta / ventasNetas) * 100) : 0;

    // Efectivo esperado en cajón: Base Inicial + Ventas en Efectivo - Gastos retirados en Efectivo
    const efectivoEsperado = redondearMoneda(valorBase + ventasEfectivo - gastosEfectivo);

    // Consolidar lista cronológica de movimientos de caja
    const movimientos = [
      ...caja.facturas.map((f) => {
        const esAnulada = f.estado === EstadoFactura.anulada;
        const origenStr = f.id_mesa
          ? `Pago Mesa #${f.mesa?.numero}`
          : (f.cliente_nombre ? `Domicilio - ${f.cliente_nombre}` : 'Venta Directa / Barra');

        return {
          id: `factura-${f.id_venta}`,
          hora: f.fecha_hora,
          descripcion: esAnulada
            ? `[ANULADA] ${origenStr} (${f.motivo_anulacion || 'Anulada'})`
            : origenStr,
          tipo: (esAnulada ? 'Anulada' : 'Ingreso') as 'Ingreso' | 'Gasto' | 'Anulada',
          monto: esAnulada ? 0 : Number(f.valor_total),
          medio_pago: f.pagos.map((p) => p.medioPago?.nombre).join(', ') || 'Efectivo',
          responsable: f.usuario?.nombre || 'Cajero',
        };
      }),
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
        ventas_netas: ventasNetas,
        total_propinas: totalPropinas,
        total_transacciones: transaccionesValidas,
        total_facturas_anuladas: totalFacturasAnuladas,
        ventas_efectivo: ventasEfectivo,
        ventas_tarjeta: ventasTarjeta,
        ventas_transferencia: ventasTransferencia,
        total_gastos: totalGastos,
        gastos_efectivo: gastosEfectivo,
        desglose_gastos: desgloseGastos,
        total_movimientos_gasto: caja.gastos.length,
        efectivo_esperado: efectivoEsperado,
        costo_insumos: totalCostoInsumos,
        utilidad_operativa: utilidadOperativa,
        utilidad_del_dia: utilidadNeta,
        utilidad_neta: utilidadNeta,
        margen_utilidad_porcentaje: margenUtilidadPorcentaje,
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
   * Realiza el arqueo y cierre atómico del turno de caja comparando teórico vs físico.
   */
  async cerrarCaja(dto: CerrarCajaDto, id_usuario: number) {
    if (dto.valor_final_fisico < 0) {
      throw new BadRequestException('El valor físico final no puede ser negativo.');
    }

    await this.asegurarCatalogosBase();

    const ejecutarCierre = async (tx: any) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(730301)`;
      }

      const caja = await tx.caja.findFirst({
        where: { estado: EstadoCaja.abierta },
        include: {
          usuarioApertura: {
            select: { id_usuario: true, nombre: true, rol: true },
          },
          facturas: {
            include: {
              mesa: true,
              usuario: { select: { id_usuario: true, nombre: true } },
              pagos: { include: { medioPago: true } },
              pedidos: {
                include: {
                  items: {
                    include: {
                      producto: {
                        select: { id_producto: true, nombre: true, costo: true, precio_venta: true },
                      },
                    },
                  },
                },
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
        throw new BadRequestException('No hay ninguna caja abierta en el sistema para realizar arqueo.');
      }

      // 1. Validar que no existan pedidos pendientes de pago o sin facturar
      const pedidosSinFacturar = await tx.pedido.count({
        where: {
          estado: EstadoPedido.enviada,
          id_factura: null,
        },
      });

      if (pedidosSinFacturar > 0) {
        throw new BadRequestException(
          `No es posible cerrar la caja: existen ${pedidosSinFacturar} comanda(s) activas sin cobrar ni facturar. Debes cobrar o cancelar todas las cuentas antes de realizar el arqueo.`,
        );
      }

      // 2. Archivar operativamente pedidos facturados que sigan en estado 'enviada'
      await tx.pedido.updateMany({
        where: {
          estado: EstadoPedido.enviada,
          id_factura: { not: null },
        },
        data: {
          estado: EstadoPedido.cerrada,
        },
      });

      // 3. Calcular resumen contable dentro de la misma transacción serializada
      const valorBase = redondearMoneda(Number(caja.valor_inicial));
      let ventasEfectivo = 0;
      let ventasTarjeta = 0;
      let ventasTransferencia = 0;
      let totalVentas = 0;
      let totalPropinas = 0;
      let totalCostoInsumos = 0;

      for (const f of caja.facturas || []) {
        if (f.estado === EstadoFactura.anulada) continue;
        totalVentas += Number(f.valor_total);
        totalPropinas += Number(f.propina || 0);
        if (Array.isArray(f.pedidos)) {
          for (const ped of f.pedidos) {
            if (Array.isArray(ped.items)) {
              for (const it of ped.items) {
                totalCostoInsumos += (Number(it.cantidad) || 0) * (Number(it.producto?.costo) || 0);
              }
            }
          }
        }
        for (const p of f.pagos || []) {
          const met = normalizarMedioPago(p.medioPago?.nombre);
          const monto = Number(p.monto);
          if (met === 'efectivo') ventasEfectivo += monto;
          else if (met === 'tarjeta') ventasTarjeta += monto;
          else ventasTransferencia += monto;
        }
      }

      let totalGastos = 0;
      let gastosEfectivo = 0;
      for (const g of caja.gastos || []) {
        const monto = Number(g.total);
        totalGastos += monto;
        if (normalizarMedioPago(g.medioPago?.nombre) === 'efectivo' || !g.medioPago) {
          gastosEfectivo += monto;
        }
      }

      ventasEfectivo = redondearMoneda(ventasEfectivo);
      ventasTarjeta = redondearMoneda(ventasTarjeta);
      ventasTransferencia = redondearMoneda(ventasTransferencia);
      totalVentas = redondearMoneda(totalVentas);
      totalPropinas = redondearMoneda(totalPropinas);
      totalGastos = redondearMoneda(totalGastos);
      gastosEfectivo = redondearMoneda(gastosEfectivo);
      totalCostoInsumos = redondearMoneda(totalCostoInsumos);

      const ventasNetas = redondearMoneda(totalVentas - totalPropinas);
      const utilidadNeta = redondearMoneda(ventasNetas - totalCostoInsumos - totalGastos);
      const valorTeorico = redondearMoneda(valorBase + ventasEfectivo - gastosEfectivo);
      const valorFisico = redondearMoneda(dto.valor_final_fisico);
      let diferencia = redondearMoneda(valorFisico - valorTeorico);

      if (Math.abs(diferencia) < 0.01) {
        diferencia = 0;
      }

      // Consolidar observaciones y conciliación de transferencias bancarias
      const notas: string[] = [];
      if (dto.valor_transferencias_reportado !== undefined && dto.valor_transferencias_reportado !== null) {
        const reporteTransf = redondearMoneda(dto.valor_transferencias_reportado);
        const difTransf = redondearMoneda(reporteTransf - ventasTransferencia);
        if (difTransf !== 0) {
          notas.push(`[Transf. Banco: $${reporteTransf} vs Sistema: $${ventasTransferencia} (Dif: ${difTransf > 0 ? '+' : ''}$${difTransf})]`);
        } else {
          notas.push(`[Transf. Banco conciliada exacta: $${reporteTransf}]`);
        }
      }
      if (dto.observacion?.trim()) {
        notas.push(dto.observacion.trim());
      }
      const observacionFinal = notas.length > 0 ? notas.join(' | ').substring(0, 255) : null;

      const cajaCerrada = await tx.caja.update({
        where: { id_caja: caja.id_caja },
        data: {
          id_usuario_cierre: id_usuario,
          fecha_cierre: new Date(),
          valor_final_teorico: new Prisma.Decimal(valorTeorico),
          valor_final_fisico: new Prisma.Decimal(valorFisico),
          diferencia: new Prisma.Decimal(diferencia),
          observacion: observacionFinal,
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
        total_ventas: totalVentas,
        ventas_efectivo: ventasEfectivo,
        ventas_transferencia: ventasTransferencia,
        ventas_tarjeta: ventasTarjeta,
        total_gastos: totalGastos,
        gastos_efectivo: gastosEfectivo,
        total_propinas: totalPropinas,
        valor_final_teorico: valorTeorico,
        valor_final_fisico: valorFisico,
        diferencia,
        utilidad_del_dia: utilidadNeta,
        utilidad_neta: utilidadNeta,
        observacion: cajaCerrada.observacion || undefined,
        tipo_cuadre: diferencia === 0 ? 'exacto' : diferencia > 0 ? 'sobrante' : 'faltante',
        cajero_cierre: cajaCerrada.usuarioCierre?.nombre || 'Cajero',
      };
    };

    return typeof this.prisma.$transaction === 'function'
      ? this.prisma.$transaction((tx) => ejecutarCierre(tx))
      : ejecutarCierre(this.prisma);
  }

  /**
   * Actualiza el valor base inicial de la caja activa.
   */
  async actualizarBaseCaja(valor_inicial: number) {
    if (valor_inicial < 0) {
      throw new BadRequestException('El valor base inicial no puede ser negativo.');
    }

    const caja = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
    });

    if (!caja) {
      throw new BadRequestException('No hay ninguna caja abierta actualmente para modificar el valor base.');
    }

    const cajaActualizada = await this.prisma.caja.update({
      where: { id_caja: caja.id_caja },
      data: {
        valor_inicial: new Prisma.Decimal(valor_inicial),
      },
    });

    return {
      exito: true,
      mensaje: 'Valor base de caja actualizado exitosamente.',
      id_caja: cajaActualizada.id_caja,
      nuevo_valor_base: Number(cajaActualizada.valor_inicial),
    };
  }

  /**
   * Obtiene el histórico de turnos de caja cerrados con desglose contable (Efectivo vs Transferencias vs Tarjeta).
   * Excluye facturas anuladas de las ventas y normaliza medios de pago.
   */
  async obtenerHistorial(limite = 30, filtros?: FiltroRangoFecha) {
    const rangoFecha = resolverRangoFechaOpcional(filtros);
    const where: any = { estado: EstadoCaja.cerrada };
    if (rangoFecha) {
      where.fecha_cierre = rangoFecha;
    }

    const turnos = await this.prisma.caja.findMany({
      where,
      orderBy: { fecha_cierre: 'desc' },
      take: limite,
      include: {
        usuarioApertura: { select: { nombre: true } },
        usuarioCierre: { select: { nombre: true } },
        _count: {
          select: { facturas: true, gastos: true },
        },
        facturas: {
          include: {
            pagos: {
              include: { medioPago: true },
            },
            pedidos: {
              include: {
                items: {
                  include: {
                    producto: {
                      select: { costo: true },
                    },
                  },
                },
              },
            },
          },
        },
        gastos: {
          include: {
            medioPago: true,
            tipoGasto: true,
          },
        },
      },
    });

    return turnos.map((t) => {
      let totalVentas = 0;
      let ventasEfectivo = 0;
      let ventasTransferencia = 0;
      let ventasTarjeta = 0;
      let totalPropinas = 0;
      let totalCostoInsumos = 0;
      let facturasValidas = 0;
      let facturasAnuladas = 0;

      for (const fac of t.facturas) {
        if (fac.estado === EstadoFactura.anulada) {
          facturasAnuladas++;
          continue; // Excluir facturas anuladas de los totales financieros históricos
        }

        facturasValidas++;
        totalVentas += Number(fac.valor_total);
        totalPropinas += Number(fac.propina);

        if (Array.isArray((fac as any).pedidos)) {
          for (const ped of (fac as any).pedidos) {
            if (Array.isArray(ped.items)) {
              for (const it of ped.items) {
                totalCostoInsumos += (Number(it.cantidad) || 0) * (Number(it.producto?.costo) || 0);
              }
            }
          }
        }

        for (const p of fac.pagos) {
          const monto = Number(p.monto);
          const medio = normalizarMedioPago(p.medioPago?.nombre);
          if (medio === 'efectivo') ventasEfectivo += monto;
          else if (medio === 'tarjeta') ventasTarjeta += monto;
          else ventasTransferencia += monto;
        }
      }

      let totalGastos = 0;
      let gastosEfectivo = 0;
      for (const g of t.gastos) {
        const monto = Number(g.total);
        totalGastos += monto;
        const medio = normalizarMedioPago(g.medioPago?.nombre);
        if (medio === 'efectivo' || !g.medioPago) {
          gastosEfectivo += monto;
        }
      }

      return {
        id_caja: t.id_caja,
        fecha_apertura: t.fecha_apertura,
        fecha_cierre: t.fecha_cierre,
        usuarioApertura: t.usuarioApertura,
        usuarioCierre: t.usuarioCierre,
        valor_inicial: Number(t.valor_inicial),
        valor_final_teorico: Number(t.valor_final_teorico || 0),
        valor_final_fisico: Number(t.valor_final_fisico || 0),
        diferencia: Number(t.diferencia || 0),
        total_ventas: redondearMoneda(totalVentas),
        ventas_netas: redondearMoneda(totalVentas - totalPropinas),
        costo_insumos: redondearMoneda(totalCostoInsumos),
        utilidad_del_dia: redondearMoneda(totalVentas - totalPropinas - totalCostoInsumos - totalGastos),
        utilidad_neta: redondearMoneda(totalVentas - totalPropinas - totalCostoInsumos - totalGastos),
        ventas_efectivo: redondearMoneda(ventasEfectivo),
        ventas_transferencia: redondearMoneda(ventasTransferencia),
        ventas_tarjeta: redondearMoneda(ventasTarjeta),
        total_propinas: redondearMoneda(totalPropinas),
        total_gastos: redondearMoneda(totalGastos),
        gastos_efectivo: redondearMoneda(gastosEfectivo),
        facturas_validas: facturasValidas,
        facturas_anuladas: facturasAnuladas,
        observacion: t.observacion || undefined,
        _count: t._count,
      };
    });
  }

  /**
   * Actualiza la observación de un turno cerrado de caja (exclusivo para super administrador).
   * La caja NO puede ser eliminada por regulaciones contables y de auditoría.
   */
  async actualizarObservacionTurno(id_caja: number, observacion: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id_caja },
    });

    if (!caja) {
      throw new NotFoundException(`El turno de caja #${id_caja} no fue encontrado.`);
    }

    const textoObservacion =
      typeof observacion === 'string' && observacion.trim().length > 0
        ? observacion.trim().slice(0, 255)
        : null;

    return this.prisma.caja.update({
      where: { id_caja },
      data: {
        observacion: textoObservacion,
      },
    });
  }

  /**
   * Reinicia parcialmente los datos operativos (turnos de caja, facturas, pagos, pedidos y gastos)
   * preservando intactos los usuarios y el catálogo completo de productos/categorías.
   */
  async resetOperacional() {
    return this.prisma.$transaction(async (tx) => {
      await tx.pago.deleteMany({});
      await tx.gasto.deleteMany({});
      await tx.itemPedido.deleteMany({});
      await tx.pedido.deleteMany({});
      await tx.factura.deleteMany({});
      await tx.caja.deleteMany({});
      await tx.mesa.updateMany({
        data: {
          estado: 'libre',
        },
      });

      return {
        success: true,
        message: 'Datos operativos reiniciados correctamente. Catálogo y usuarios preservados.',
      };
    });
  }

  /**
   * Obtiene la lista histórica de gastos registrados en caja.
   */
  async obtenerGastos(limite = 50, filtros?: FiltroRangoFecha) {
    const rangoFecha = resolverRangoFechaOpcional(filtros);
    const where: any = {};
    if (rangoFecha) {
      where.fecha_hora = rangoFecha;
    }

    return this.prisma.gasto.findMany({
      where,
      take: limite,
      orderBy: { fecha_hora: 'desc' },
      include: {
        tipoGasto: true,
        medioPago: true,
        caja: {
          select: {
            id_caja: true,
            estado: true,
            fecha_apertura: true,
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            rol: true,
          },
        },
      },
    });
  }

  /**
   * Actualiza los datos de un gasto registrado.
   */
  async actualizarGasto(id: number, dto: UpdateGastoDto, usuarioAuth?: any) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id_gasto: id },
      include: { caja: true },
    });

    if (!gasto) {
      throw new NotFoundException(`El gasto #${id} no fue encontrado.`);
    }

    if (gasto.caja?.estado === EstadoCaja.cerrada && usuarioAuth?.rol !== RolUsuario.administrador) {
      throw new BadRequestException(
        'Este gasto pertenece a un turno de caja que ya fue cerrado y arqueado. Solo un Administrador puede realizar correcciones retroactivas.',
      );
    }

    const data: any = {};
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion.trim().slice(0, 255);
    if (dto.observacion !== undefined) data.observacion = dto.observacion ? dto.observacion.trim().slice(0, 255) : null;
    if (dto.total !== undefined) data.total = new Prisma.Decimal(dto.total);

    if (dto.tipo_gasto) {
      let tipoGasto = await this.prisma.tipoGasto.findUnique({
        where: { nombre: dto.tipo_gasto.trim() },
      });
      if (!tipoGasto) {
        tipoGasto = await this.prisma.tipoGasto.create({
          data: { nombre: dto.tipo_gasto.trim() },
        });
      }
      data.id_tipo_gasto = tipoGasto.id_tipo_gasto;
    }

    if (dto.medio_pago) {
      let medioPago = await this.prisma.medioPago.findUnique({
        where: { nombre: dto.medio_pago.trim() },
      });
      if (!medioPago) {
        medioPago = await this.prisma.medioPago.create({
          data: { nombre: dto.medio_pago.trim() },
        });
      }
      data.id_medio_pago = medioPago.id_medio_pago;
    }

    return this.prisma.gasto.update({
      where: { id_gasto: id },
      data,
      include: {
        tipoGasto: true,
        medioPago: true,
        caja: { select: { id_caja: true, estado: true, fecha_apertura: true } },
        usuario: { select: { id_usuario: true, nombre: true, rol: true } },
      },
    }).then(async (gastoActualizado) => {
      if (gasto.caja?.estado === EstadoCaja.cerrada) {
        await this.recalcularArqueoCajaCerrada(gasto.id_caja);
      }
      return gastoActualizado;
    });
  }

  /**
   * Elimina un gasto del sistema. Exclusivo para Super Administrador.
   */
  async eliminarGasto(id: number) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id_gasto: id },
      include: { caja: true },
    });

    if (!gasto) {
      throw new NotFoundException(`El gasto #${id} no fue encontrado.`);
    }

    await this.prisma.gasto.delete({
      where: { id_gasto: id },
    });

    if (gasto.caja?.estado === EstadoCaja.cerrada) {
      await this.recalcularArqueoCajaCerrada(gasto.id_caja);
    }

    return {
      success: true,
      mensaje: `Gasto #${id} eliminado exitosamente.`,
    };
  }

  /**
   * Recalcula el valor teórico en efectivo y la diferencia de una caja cerrada tras ajustes retroactivos de un administrador.
   */
  private async recalcularArqueoCajaCerrada(id_caja: number): Promise<void> {
    const caja = await this.prisma.caja.findUnique({
      where: { id_caja },
      include: {
        facturas: {
          where: { estado: EstadoFactura.emitida },
          include: { pagos: { include: { medioPago: true } } },
        },
        gastos: {
          include: { medioPago: true },
        },
      },
    });
    if (!caja || caja.estado !== EstadoCaja.cerrada) return;

    let ventasEfectivo = 0;
    for (const f of caja.facturas) {
      for (const p of f.pagos) {
        if (normalizarMedioPago(p.medioPago?.nombre) === 'efectivo') {
          ventasEfectivo += Number(p.monto);
        }
      }
    }

    let gastosEfectivo = 0;
    for (const g of caja.gastos) {
      if (normalizarMedioPago(g.medioPago?.nombre) === 'efectivo' || !g.medioPago) {
        gastosEfectivo += Number(g.total);
      }
    }

    const nuevoTeorico = redondearMoneda(Number(caja.valor_inicial) + ventasEfectivo - gastosEfectivo);
    const fisico = Number(caja.valor_final_fisico ?? nuevoTeorico);
    let nuevaDif = redondearMoneda(fisico - nuevoTeorico);
    if (Math.abs(nuevaDif) < 0.01) nuevaDif = 0;

    await this.prisma.caja.update({
      where: { id_caja },
      data: {
        valor_final_teorico: new Prisma.Decimal(nuevoTeorico),
        diferencia: new Prisma.Decimal(nuevaDif),
      },
    });
  }
}
