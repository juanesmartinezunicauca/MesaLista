import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodoReporte, QueryReporteDto } from './dto';

export interface RangoFechas {
  inicio: Date;
  fin: Date;
  etiqueta: string;
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el rango de fechas en zona horaria local (Colombia - UTC-5)
   * según el periodo seleccionado.
   */
  calcularRangoFechas(query: QueryReporteDto): RangoFechas {
    const periodo = query.periodo || PeriodoReporte.HOY;
    const now = new Date();

    // Obtener la fecha local en formato YYYY-MM-DD para Colombia
    const hoyStr = now.toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    });

    if (periodo === PeriodoReporte.HOY) {
      const inicio = new Date(`${hoyStr}T00:00:00.000-05:00`);
      const fin = new Date(`${hoyStr}T23:59:59.999-05:00`);
      return { inicio, fin, etiqueta: `Hoy (${hoyStr})` };
    }

    if (periodo === PeriodoReporte.SEMANA) {
      const dateLocal = new Date(`${hoyStr}T00:00:00.000-05:00`);
      dateLocal.setDate(dateLocal.getDate() - 6);
      const inicioStr = dateLocal.toLocaleDateString('en-CA', {
        timeZone: 'America/Bogota',
      });
      const inicio = new Date(`${inicioStr}T00:00:00.000-05:00`);
      const fin = new Date(`${hoyStr}T23:59:59.999-05:00`);
      return { inicio, fin, etiqueta: `Últimos 7 días (${inicioStr} a ${hoyStr})` };
    }

    if (periodo === PeriodoReporte.MES) {
      const [year, month] = hoyStr.split('-').map(Number);
      const inicioStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const inicio = new Date(`${inicioStr}T00:00:00.000-05:00`);
      const fin = new Date(`${hoyStr}T23:59:59.999-05:00`);
      return { inicio, fin, etiqueta: `Este Mes (${inicioStr} a ${hoyStr})` };
    }

    if (periodo === PeriodoReporte.PERSONALIZADO) {
      if (!query.fecha_inicio || !query.fecha_fin) {
        throw new BadRequestException(
          'Para el periodo personalizado debes especificar fecha_inicio y fecha_fin en formato YYYY-MM-DD.',
        );
      }

      const inicio = new Date(`${query.fecha_inicio}T00:00:00.000-05:00`);
      const fin = new Date(`${query.fecha_fin}T23:59:59.999-05:00`);

      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
        throw new BadRequestException('Formato de fecha inválido. Utilice YYYY-MM-DD.');
      }

      if (inicio > fin) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser posterior a la fecha final.',
        );
      }

      return {
        inicio,
        fin,
        etiqueta: `Rango personalizado (${query.fecha_inicio} a ${query.fecha_fin})`,
      };
    }

    const inicio = new Date(`${hoyStr}T00:00:00.000-05:00`);
    const fin = new Date(`${hoyStr}T23:59:59.999-05:00`);
    return { inicio, fin, etiqueta: `Hoy (${hoyStr})` };
  }

  /**
   * Genera el informe analítico y financiero ejecutivo del período solicitado.
   */
  async obtenerResumenEjecutivo(query: QueryReporteDto) {
    const { inicio, fin, etiqueta } = this.calcularRangoFechas(query);

    // 1. Consultar facturas dentro del rango
    const facturas = await this.prisma.factura.findMany({
      where: {
        fecha_hora: {
          gte: inicio,
          lte: fin,
        },
      },
      include: {
        mesa: true,
        cliente: true,
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
                    categoria: true,
                    costo: true,
                    precio_venta: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { fecha_hora: 'asc' },
    });

    // 2. Consultar gastos dentro del rango
    const gastos = await this.prisma.gasto.findMany({
      where: {
        fecha_hora: {
          gte: inicio,
          lte: fin,
        },
      },
      include: {
        tipoGasto: true,
        medioPago: true,
        usuario: { select: { id_usuario: true, nombre: true } },
      },
      orderBy: { fecha_hora: 'asc' },
    });

    // 3. Métricas base
    let totalIngresos = 0;
    let subtotalVentas = 0;
    let totalPropinas = 0;
    let costoMercanciaVendida = 0;
    let totalPedidos = 0;

    // Métricas por canal
    let totalSalon = 0;
    let facturasSalon = 0;
    let totalDomicilio = 0;
    let facturasDomicilio = 0;

    // Desglose de medios de pago
    const mediosMap = new Map<string, { nombre: string; monto: number; transacciones: number }>();

    // Ranking de productos
    const productosMap = new Map<
      number,
      {
        id_producto: number;
        nombre: string;
        categoria: string;
        cantidad_vendida: number;
        total_recaudado: number;
        costo_total: number;
        margen_estimado: number;
      }
    >();

    // Serie temporal de ventas y pedidos
    const serieMap = new Map<
      string,
      { fecha: string; label: string; ingresos: number; gastos: number; pedidos: number }
    >();

    for (const f of facturas) {
      const valTotal = Number(f.valor_total);
      const valSubtotal = Number(f.valor);
      const valPropina = Number(f.propina);

      totalIngresos += valTotal;
      subtotalVentas += valSubtotal;
      totalPropinas += valPropina;
      totalPedidos += f.pedidos.length;

      // Canal (Salón vs Domicilio)
      const esDomicilio = f.id_cliente !== null && f.id_mesa === null;
      if (esDomicilio) {
        totalDomicilio += valTotal;
        facturasDomicilio++;
      } else {
        totalSalon += valTotal;
        facturasSalon++;
      }

      // Medios de pago
      for (const p of f.pagos) {
        const nombreMedio = p.medioPago?.nombre || 'Efectivo';
        const monto = Number(p.monto);
        const actualMedio = mediosMap.get(nombreMedio) || {
          nombre: nombreMedio,
          monto: 0,
          transacciones: 0,
        };
        actualMedio.monto += monto;
        actualMedio.transacciones++;
        mediosMap.set(nombreMedio, actualMedio);
      }

      // Productos vendidos y CMV
      for (const ped of f.pedidos) {
        for (const item of ped.items) {
          const idProd = item.id_producto;
          const cant = item.cantidad;
          const unitPrice = Number(item.precio_unitario);
          const costoUnit = Number(item.producto?.costo || 0);

          const totalItem = cant * unitPrice;
          const costoItem = cant * costoUnit;

          costoMercanciaVendida += costoItem;

          const prodActual = productosMap.get(idProd) || {
            id_producto: idProd,
            nombre: item.producto?.nombre || `Producto #${idProd}`,
            categoria: item.producto?.categoria || 'General',
            cantidad_vendida: 0,
            total_recaudado: 0,
            costo_total: 0,
            margen_estimado: 0,
          };

          prodActual.cantidad_vendida += cant;
          prodActual.total_recaudado += totalItem;
          prodActual.costo_total += costoItem;
          prodActual.margen_estimado = prodActual.total_recaudado - prodActual.costo_total;

          productosMap.set(idProd, prodActual);
        }
      }

      // Agrupación en serie temporal
      const fDate = new Date(f.fecha_hora);
      let claveSerie: string;
      let labelSerie: string;

      if (query.periodo === PeriodoReporte.HOY) {
        // Por hora: "14:00"
        const hora = fDate.toLocaleTimeString('es-CO', {
          timeZone: 'America/Bogota',
          hour: '2-digit',
          hour12: false,
        });
        claveSerie = `${hora}:00`;
        labelSerie = `${hora}:00`;
      } else {
        // Por día: "2026-09-29"
        claveSerie = fDate.toLocaleDateString('en-CA', {
          timeZone: 'America/Bogota',
        });
        labelSerie = fDate.toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      }

      const puntoSerie = serieMap.get(claveSerie) || {
        fecha: claveSerie,
        label: labelSerie,
        ingresos: 0,
        gastos: 0,
        pedidos: 0,
      };
      puntoSerie.ingresos += valTotal;
      puntoSerie.pedidos += f.pedidos.length || 1;
      serieMap.set(claveSerie, puntoSerie);
    }

    // 4. Calcular métricas de gastos
    let totalGastos = 0;
    const gastosCategoriasMap = new Map<
      string,
      { categoria: string; total: number; movimientos: number }
    >();

    for (const g of gastos) {
      const monto = Number(g.total);
      totalGastos += monto;

      const categoria = g.tipoGasto?.nombre || 'General';
      const actualGasto = gastosCategoriasMap.get(categoria) || {
        categoria,
        total: 0,
        movimientos: 0,
      };
      actualGasto.total += monto;
      actualGasto.movimientos++;
      gastosCategoriasMap.set(categoria, actualGasto);

      // Agregar a serie temporal
      const gDate = new Date(g.fecha_hora);
      let claveSerie: string;
      let labelSerie: string;

      if (query.periodo === PeriodoReporte.HOY) {
        const hora = gDate.toLocaleTimeString('es-CO', {
          timeZone: 'America/Bogota',
          hour: '2-digit',
          hour12: false,
        });
        claveSerie = `${hora}:00`;
        labelSerie = `${hora}:00`;
      } else {
        claveSerie = gDate.toLocaleDateString('en-CA', {
          timeZone: 'America/Bogota',
        });
        labelSerie = gDate.toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      }

      const puntoSerie = serieMap.get(claveSerie) || {
        fecha: claveSerie,
        label: labelSerie,
        ingresos: 0,
        gastos: 0,
        pedidos: 0,
      };
      puntoSerie.gastos += monto;
      serieMap.set(claveSerie, puntoSerie);
    }

    // 5. Cálculos derivados
    const totalFacturas = facturas.length;
    const ticketPromedio = totalFacturas > 0 ? Math.round(totalIngresos / totalFacturas) : 0;
    const utilidadNeta = totalIngresos - totalGastos;
    const margenBruto = subtotalVentas - costoMercanciaVendida;
    const porcentajeMargen =
      subtotalVentas > 0
        ? Math.round((margenBruto / subtotalVentas) * 1000) / 10
        : 0;

    // Desglose de medios con porcentajes
    const desgloseMediosPago = Array.from(mediosMap.values()).map((m) => ({
      ...m,
      porcentaje:
        totalIngresos > 0
          ? Math.round((m.monto / totalIngresos) * 1000) / 10
          : 0,
    }));

    // Top 10 productos más vendidos
    const topProductos = Array.from(productosMap.values())
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida || b.total_recaudado - a.total_recaudado)
      .slice(0, 10);

    // Desglose de gastos con porcentajes
    const desgloseGastos = Array.from(gastosCategoriasMap.values()).map((g) => ({
      ...g,
      porcentaje:
        totalGastos > 0
          ? Math.round((g.total / totalGastos) * 1000) / 10
          : 0,
    }));

    // Serie temporal ordenada
    const serieTemporal = Array.from(serieMap.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );

    return {
      periodo: query.periodo || PeriodoReporte.HOY,
      etiqueta,
      rango: {
        inicio,
        fin,
      },
      kpis: {
        ingresos_totales: totalIngresos,
        subtotal_ventas: subtotalVentas,
        total_propinas: totalPropinas,
        total_gastos: totalGastos,
        utilidad_neta: utilidadNeta,
        costo_mercancia_vendida: costoMercanciaVendida,
        margen_bruto: margenBruto,
        porcentaje_margen: porcentajeMargen,
        total_facturas: totalFacturas,
        total_pedidos: totalPedidos,
        ticket_promedio: ticketPromedio,
      },
      canales: {
        salon: {
          facturas: facturasSalon,
          total: totalSalon,
          porcentaje:
            totalIngresos > 0
              ? Math.round((totalSalon / totalIngresos) * 1000) / 10
              : 0,
        },
        domicilio: {
          facturas: facturasDomicilio,
          total: totalDomicilio,
          porcentaje:
            totalIngresos > 0
              ? Math.round((totalDomicilio / totalIngresos) * 1000) / 10
              : 0,
        },
      },
      medios_pago: desgloseMediosPago,
      top_productos: topProductos,
      desglose_gastos: desgloseGastos,
      serie_temporal: serieTemporal,
    };
  }

  /**
   * Consulta el histórico de turnos de caja para auditoría y control de arqueos.
   */
  async obtenerHistorialTurnosCaja(limite = 15) {
    const turnos = await this.prisma.caja.findMany({
      take: Math.min(limite, 50),
      orderBy: { fecha_apertura: 'desc' },
      include: {
        usuarioApertura: {
          select: { id_usuario: true, nombre: true, rol: true },
        },
        usuarioCierre: {
          select: { id_usuario: true, nombre: true, rol: true },
        },
        _count: {
          select: { facturas: true, gastos: true },
        },
      },
    });

    return turnos.map((t) => {
      const valorInicial = Number(t.valor_inicial);
      const teorico = t.valor_final_teorico !== null ? Number(t.valor_final_teorico) : null;
      const fisico = t.valor_final_fisico !== null ? Number(t.valor_final_fisico) : null;
      const diferencia = t.diferencia !== null ? Number(t.diferencia) : null;

      return {
        id_caja: t.id_caja,
        fecha_apertura: t.fecha_apertura,
        fecha_cierre: t.fecha_cierre,
        estado: t.estado,
        valor_inicial: valorInicial,
        valor_final_teorico: teorico,
        valor_final_fisico: fisico,
        diferencia,
        usuario_apertura: t.usuarioApertura.nombre,
        usuario_cierre: t.usuarioCierre?.nombre || null,
        total_facturas: t._count.facturas,
        total_gastos: t._count.gastos,
      };
    });
  }

  /**
   * Exporta las métricas consolidadas en formato CSV estructurado.
   */
  async exportarReporteCsv(query: QueryReporteDto): Promise<string> {
    const data = await this.obtenerResumenEjecutivo(query);

    const lineas: string[] = [];
    lineas.push(`"REPORTE EJECUTIVO Y ANALÍTICO - MESALISTA POS"`);
    lineas.push(`"Periodo:","${data.etiqueta}"`);
    lineas.push(`"Fecha Generación:","${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`);
    lineas.push('');

    // KPIs
    lineas.push('"MÉTRICAS PRINCIPALES"');
    lineas.push('"Indicador","Valor"');
    lineas.push(`"Ingresos Totales (con propinas)",${data.kpis.ingresos_totales}`);
    lineas.push(`"Subtotal Ventas",${data.kpis.subtotal_ventas}`);
    lineas.push(`"Total Propinas",${data.kpis.total_propinas}`);
    lineas.push(`"Total Gastos Operativos",${data.kpis.total_gastos}`);
    lineas.push(`"Utilidad Neta",${data.kpis.utilidad_neta}`);
    lineas.push(`"Costo Mercancía Vendida (CMV)",${data.kpis.costo_mercancia_vendida}`);
    lineas.push(`"Margen Bruto",${data.kpis.margen_bruto}`);
    lineas.push(`"Margen %",${data.kpis.porcentaje_margen}%`);
    lineas.push(`"Total Facturas Emitidas",${data.kpis.total_facturas}`);
    lineas.push(`"Total Pedidos",${data.kpis.total_pedidos}`);
    lineas.push(`"Ticket Promedio",${data.kpis.ticket_promedio}`);
    lineas.push('');

    // Canales
    lineas.push('"VENTAS POR CANAL"');
    lineas.push('"Canal","Facturas","Total Vendido","Participación"');
    lineas.push(`"Salón (Mesas)",${data.canales.salon.facturas},${data.canales.salon.total},${data.canales.salon.porcentaje}%`);
    lineas.push(`"Domicilios",${data.canales.domicilio.facturas},${data.canales.domicilio.total},${data.canales.domicilio.porcentaje}%`);
    lineas.push('');

    // Medios de pago
    lineas.push('"MEDIOS DE PAGO"');
    lineas.push('"Medio","Total","Transacciones","Participación"');
    for (const m of data.medios_pago) {
      lineas.push(`"${m.nombre}",${m.monto},${m.transacciones},${m.porcentaje}%`);
    }
    lineas.push('');

    // Top Productos
    lineas.push('"TOP PRODUCTOS MÁS VENDIDOS"');
    lineas.push('"Ranking","Producto","Categoría","Unidades","Total Recaudado","Costo Total","Margen"');
    data.top_productos.forEach((p, idx) => {
      lineas.push(`"#${idx + 1}","${p.nombre}","${p.categoria}",${p.cantidad_vendida},${p.total_recaudado},${p.costo_total},${p.margen_estimado}`);
    });
    lineas.push('');

    // Gastos por categoría
    lineas.push('"DESGLOSE DE GASTOS"');
    lineas.push('"Categoría","Total Gastado","Movimientos","Participación"');
    for (const g of data.desglose_gastos) {
      lineas.push(`"${g.categoria}",${g.total},${g.movimientos},${g.porcentaje}%`);
    }

    return lineas.join('\r\n');
  }
}
