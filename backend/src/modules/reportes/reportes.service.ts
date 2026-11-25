import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EstadoCaja,
  EstadoFactura,
  EstadoPedido,
  TipoPedido,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizarMedioPago, redondearMoneda } from '../../common/utils/contabilidad.util';
import { resolverRangoFechaOpcional } from '../../common/utils/date-range.util';
import {
  FiltroFechasDto,
  FiltroGastosDto,
  FiltroInventarioDto,
  FiltroOperacionDto,
  FiltroRentabilidadDto,
  FiltroVentasDto,
} from './dto';

const MAX_DIAS_RANGO_REPORTE = 366;

/**
 * Etiqueta legible estándar para un medio de pago normalizado.
 */
function etiquetaMedioPago(nombre?: string | null): 'Efectivo' | 'Tarjeta' | 'Transferencia' {
  const met = normalizarMedioPago(nombre);
  if (met === 'tarjeta') return 'Tarjeta';
  if (met === 'transferencia') return 'Transferencia';
  return 'Efectivo';
}

/**
 * Resuelve y valida el rango de fechas en la zona horaria de Colombia (America/Bogota - UTC-5)
 * sin perder registros del inicio ni del final del periodo.
 */
export function resolverRangoFechas(
  fechaInicioStr?: string,
  fechaFinStr?: string,
): { inicio: Date; fin: Date; esMesPorDefecto: boolean } {
  let inicio: Date;
  let fin: Date;
  let esMesPorDefecto = false;

  const inicioTrim = fechaInicioStr?.trim();
  const finTrim = fechaFinStr?.trim();

  if (finTrim) {
    if (finTrim.includes('T')) {
      fin = new Date(finTrim);
    } else {
      fin = new Date(`${finTrim}T23:59:59.999-05:00`);
    }
  } else {
    const hoyStr = formatoFechaCol(new Date());
    fin = new Date(`${hoyStr}T23:59:59.999-05:00`);
  }

  if (Number.isNaN(fin.getTime())) {
    throw new BadRequestException('Formato de fecha inválido. Utilice formato YYYY-MM-DD o ISO 8601.');
  }

  if (fin.getUTCFullYear() < 1970 || fin.getUTCFullYear() > 2100) {
    throw new BadRequestException('El rango de fechas debe estar comprendido entre los años 1970 y 2100.');
  }

  if (inicioTrim) {
    if (inicioTrim.includes('T')) {
      inicio = new Date(inicioTrim);
    } else {
      inicio = new Date(`${inicioTrim}T00:00:00.000-05:00`);
    }
  } else {
    // Si no se especifica inicio, toma el 1er día del mes de `fin` en Colombia (evita error al filtrar meses pasados)
    esMesPorDefecto = true;
    const refCol = formatoFechaCol(fin);
    inicio = new Date(`${refCol.slice(0, 7)}-01T00:00:00.000-05:00`);
  }

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new BadRequestException('Formato de fecha inválido. Utilice formato YYYY-MM-DD o ISO 8601.');
  }

  if (
    inicio.getUTCFullYear() < 1970 ||
    inicio.getUTCFullYear() > 2100 ||
    fin.getUTCFullYear() < 1970 ||
    fin.getUTCFullYear() > 2100
  ) {
    throw new BadRequestException('El rango de fechas debe estar comprendido entre los años 1970 y 2100.');
  }

  if (inicio > fin) {
    throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final.');
  }

  const diffDias = (fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDias > MAX_DIAS_RANGO_REPORTE) {
    throw new BadRequestException(
      `El rango máximo permitido para reportes es de ${MAX_DIAS_RANGO_REPORTE} días.`,
    );
  }

  return { inicio, fin, esMesPorDefecto };
}

/**
 * Convierte un objeto Date a formato 'YYYY-MM-DD' en zona horaria America/Bogota (UTC-5).
 */
function formatoFechaCol(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Obtiene la hora en formato 0..23 en zona horaria America/Bogota (UTC-5).
 */
function obtenerHoraCol(d: Date): number {
  const horaStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(d);
  const h = Number.parseInt(horaStr, 10);
  return Number.isNaN(h) ? 0 : h % 24;
}

/**
 * Determina el canal real de una factura ('salon' vs 'domicilio') priorizando el tipo de sus pedidos.
 */
function resolverCanalFactura(factura: { id_mesa?: number | null; pedidos?: Array<{ tipo?: TipoPedido }> }): 'salon' | 'domicilio' {
  if (factura.id_mesa) return 'salon';
  if (Array.isArray(factura.pedidos) && factura.pedidos.length > 0) {
    if (factura.pedidos.some((p) => p.tipo === TipoPedido.salon)) return 'salon';
    if (factura.pedidos.every((p) => p.tipo === TipoPedido.domicilio)) return 'domicilio';
  }
  return 'domicilio';
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  // Proyección optimizada para excluir imágenes pesadas en consultas de reportes
  private readonly productoSelectMinimo = {
    id_producto: true,
    nombre: true,
    categoria: true,
    precio_venta: true,
    costo: true,
    cantidad_inventario: true,
    controla_inventario: true,
    disponible: true,
  } as const;

  /**
   * REPORT 0: DASHBOARD EJECUTIVO PRINCIPAL
   * Retorna KPIs clave, comparativa con periodo anterior equivalente, series dinámicas y alertas.
   */
  async obtenerDashboard(filtro: FiltroFechasDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    // Periodo anterior equivalente en duración para comparativas exactas
    const duracionMs = fin.getTime() - inicio.getTime() + 1;
    const inicioAnterior = new Date(inicio.getTime() - duracionMs);
    const finAnterior = new Date(inicio.getTime() - 1);

    // 1. Facturas emitidas en el periodo actual
    const facturas = await this.prisma.factura.findMany({
      where: {
        estado: EstadoFactura.emitida,
        fecha_hora: { gte: inicio, lte: fin },
      },
      include: {
        pagos: { include: { medioPago: true } },
        pedidos: {
          include: {
            items: {
              include: {
                producto: { select: this.productoSelectMinimo },
              },
            },
          },
        },
      },
      orderBy: { fecha_hora: 'asc' },
    });

    // 2. Facturas del periodo anterior equivalente
    const facturasAnteriores = await this.prisma.factura.findMany({
      where: {
        estado: EstadoFactura.emitida,
        fecha_hora: { gte: inicioAnterior, lte: finAnterior },
      },
      select: { valor_total: true },
    });

    // 3. Gastos del periodo actual
    const gastos = await this.prisma.gasto.findMany({
      where: {
        fecha_hora: { gte: inicio, lte: fin },
      },
      include: {
        tipoGasto: true,
        medioPago: true,
      },
    });

    // 4. Inventario crítico
    const productosStock = await this.prisma.producto.findMany({
      where: { controla_inventario: true },
      select: { cantidad_inventario: true },
    });

    const productosBajoStock = productosStock.filter(
      (p) => p.cantidad_inventario > 0 && p.cantidad_inventario <= 5,
    ).length;
    const productosAgotados = productosStock.filter((p) => p.cantidad_inventario <= 0).length;

    // 5. Cajas del periodo (apertura o cierre en el rango) y estado actual
    const cajasPeriodo = await this.prisma.caja.findMany({
      where: {
        OR: [
          { fecha_apertura: { gte: inicio, lte: fin } },
          { fecha_cierre: { gte: inicio, lte: fin } },
        ],
      },
      select: {
        id_caja: true,
        estado: true,
        diferencia: true,
      },
    });

    const cajasConDescuadre = cajasPeriodo.filter(
      (c) =>
        c.estado === EstadoCaja.cerrada &&
        c.diferencia !== null &&
        Math.abs(Number(c.diferencia)) >= 0.01,
    );
    const sumaDiferenciasCaja = redondearMoneda(
      cajasConDescuadre.reduce((acc, c) => acc + Number(c.diferencia || 0), 0),
    );

    const cajaActiva = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.abierta },
      select: { id_caja: true, fecha_apertura: true, valor_inicial: true },
    });

    // --- CÁLCULO DE TOTALES Y KPIS ---
    let totalVentas = 0;
    let totalVentasNetas = 0;
    let totalPropinas = 0;
    let totalSalon = 0;
    let totalDomicilio = 0;

    let recaudadoEfectivo = 0;
    let recaudadoTarjeta = 0;
    let recaudadoTransferencia = 0;

    const ventasPorDiaMap = new Map<string, { total: number; cuentas: number }>();
    const productosVendidosMap = new Map<
      number,
      { id_producto: number; nombre: string; categoria: string; unidades: number; total: number }
    >();

    for (const f of facturas) {
      const vTotal = Number(f.valor_total);
      const vSubtotal = Number(f.valor);
      const vPropina = Number(f.propina);

      totalVentas += vTotal;
      totalVentasNetas += vSubtotal;
      totalPropinas += vPropina;

      // Salón vs Domicilio
      if (resolverCanalFactura(f) === 'salon') {
        totalSalon += vTotal;
      } else {
        totalDomicilio += vTotal;
      }

      // Medios de pago
      for (const p of f.pagos) {
        const metodo = normalizarMedioPago(p.medioPago?.nombre);
        const monto = Number(p.monto);
        if (metodo === 'efectivo') recaudadoEfectivo += monto;
        else if (metodo === 'tarjeta') recaudadoTarjeta += monto;
        else recaudadoTransferencia += monto;
      }

      // Agrupación por día (Colombia UTC-5)
      const diaKey = formatoFechaCol(f.fecha_hora);
      const diaActual = ventasPorDiaMap.get(diaKey) || { total: 0, cuentas: 0 };
      diaActual.total += vTotal;
      diaActual.cuentas += 1;
      ventasPorDiaMap.set(diaKey, diaActual);

      // Top productos
      for (const ped of f.pedidos) {
        for (const it of ped.items) {
          const prodId = it.id_producto;
          const cant = it.cantidad;
          const precio = Number(it.precio_unitario);
          const exist = productosVendidosMap.get(prodId) || {
            id_producto: prodId,
            nombre: it.producto?.nombre || `Producto #${prodId}`,
            categoria: it.producto?.categoria || 'General',
            unidades: 0,
            total: 0,
          };
          exist.unidades += cant;
          exist.total += cant * precio;
          productosVendidosMap.set(prodId, exist);
        }
      }
    }

    totalVentas = redondearMoneda(totalVentas);
    totalVentasNetas = redondearMoneda(totalVentasNetas);
    totalPropinas = redondearMoneda(totalPropinas);
    totalSalon = redondearMoneda(totalSalon);
    totalDomicilio = redondearMoneda(totalDomicilio);
    recaudadoEfectivo = redondearMoneda(recaudadoEfectivo);
    recaudadoTarjeta = redondearMoneda(recaudadoTarjeta);
    recaudadoTransferencia = redondearMoneda(recaudadoTransferencia);

    const cuentasPagadas = facturas.length;
    const ticketPromedio = cuentasPagadas > 0 ? redondearMoneda(totalVentas / cuentasPagadas) : 0;

    const totalGastos = redondearMoneda(gastos.reduce((acc, g) => acc + Number(g.total), 0));

    // Comparativas con periodo anterior
    const totalVentasAnterior = redondearMoneda(
      facturasAnteriores.reduce((acc, f) => acc + Number(f.valor_total), 0),
    );
    const cuentasPagadasAnterior = facturasAnteriores.length;

    let variacionVentasPorcentaje: number | null = null;
    if (totalVentasAnterior > 0) {
      variacionVentasPorcentaje = redondearMoneda(
        ((totalVentas - totalVentasAnterior) / totalVentasAnterior) * 100,
      );
    }

    let variacionCuentasPorcentaje: number | null = null;
    if (cuentasPagadasAnterior > 0) {
      variacionCuentasPorcentaje = redondearMoneda(
        ((cuentasPagadas - cuentasPagadasAnterior) / cuentasPagadasAnterior) * 100,
      );
    }

    // Serie cronológica de ventas por día
    const serieVentasPorDia = Array.from(ventasPorDiaMap.entries())
      .map(([fecha, datos]) => ({
        fecha,
        total_ventas: redondearMoneda(datos.total),
        cuentas_pagadas: datos.cuentas,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Top 5 productos más vendidos
    const topProductos = Array.from(productosVendidosMap.values())
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        total: redondearMoneda(p.total),
      }));

    // Distribución por medio de pago
    const totalRecaudado = recaudadoEfectivo + recaudadoTarjeta + recaudadoTransferencia;
    const distribucionMediosPago = [
      {
        medio: 'Efectivo',
        total: recaudadoEfectivo,
        porcentaje: totalRecaudado > 0 ? redondearMoneda((recaudadoEfectivo / totalRecaudado) * 100) : 0,
      },
      {
        medio: 'Tarjeta',
        total: recaudadoTarjeta,
        porcentaje: totalRecaudado > 0 ? redondearMoneda((recaudadoTarjeta / totalRecaudado) * 100) : 0,
      },
      {
        medio: 'Transferencia',
        total: recaudadoTransferencia,
        porcentaje: totalRecaudado > 0 ? redondearMoneda((recaudadoTransferencia / totalRecaudado) * 100) : 0,
      },
    ];

    // Distribución por tipo de servicio
    const distribucionServicio = [
      {
        tipo: 'salon',
        etiqueta: 'Mesas / Salón',
        total: totalSalon,
        porcentaje: totalVentas > 0 ? redondearMoneda((totalSalon / totalVentas) * 100) : 0,
      },
      {
        tipo: 'domicilio',
        etiqueta: 'Domicilios',
        total: totalDomicilio,
        porcentaje: totalVentas > 0 ? redondearMoneda((totalDomicilio / totalVentas) * 100) : 0,
      },
    ];

    return {
      periodo: {
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        inicio_anterior: inicioAnterior.toISOString(),
        fin_anterior: finAnterior.toISOString(),
      },
      kpis: {
        total_ventas: totalVentas,
        ventas_netas: totalVentasNetas,
        total_propinas: totalPropinas,
        cuentas_pagadas: cuentasPagadas,
        ticket_promedio: ticketPromedio,
        total_gastos: totalGastos,
        balance_operativo: redondearMoneda(totalVentasNetas - totalGastos),
        productos_bajo_stock: productosBajoStock,
        productos_agotados: productosAgotados,
        cajas_con_diferencia: cajasConDescuadre.length,
        monto_diferencia_cajas: sumaDiferenciasCaja,
        caja_activa_abierta: !!cajaActiva,
        id_caja_activa: cajaActiva?.id_caja || null,
      },
      comparativa: {
        total_ventas_anterior: totalVentasAnterior,
        cuentas_pagadas_anterior: cuentasPagadasAnterior,
        variacion_ventas_porcentaje: variacionVentasPorcentaje,
        variacion_cuentas_porcentaje: variacionCuentasPorcentaje,
      },
      graficas: {
        serie_ventas_por_dia: serieVentasPorDia,
        top_productos: topProductos,
        distribucion_medios_pago: distribucionMediosPago,
        distribucion_servicio: distribucionServicio,
      },
    };
  }

  /**
   * REPORTE 1: VENTAS DETALLADAS
   * Incluye desglose por día, categoría, tipo de servicio, ranking de productos y listado de facturas.
   */
  async obtenerReporteVentas(filtro: FiltroVentasDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    const whereFactura: any = {
      estado: EstadoFactura.emitida,
      fecha_hora: { gte: inicio, lte: fin },
    };

    if (filtro.tipo_servicio === TipoPedido.salon) {
      whereFactura.id_mesa = { not: null };
    } else if (filtro.tipo_servicio === TipoPedido.domicilio) {
      whereFactura.id_mesa = null;
    }

    if (filtro.id_mesa) {
      whereFactura.id_mesa = filtro.id_mesa;
    }

    const facturas = await this.prisma.factura.findMany({
      where: whereFactura,
      include: {
        mesa: true,
        usuario: { select: { id_usuario: true, nombre: true } },
        pagos: { include: { medioPago: true } },
        pedidos: {
          include: {
            items: {
              include: {
                producto: { select: this.productoSelectMinimo },
              },
            },
          },
        },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    let totalVentas = 0;
    let totalSubtotal = 0;
    let totalPropinas = 0;
    let totalSalon = 0;
    let totalDomicilio = 0;
    let totalItemsCategorias = 0;
    let cuentasPagadas = 0;

    const serieDiaMap = new Map<string, { total: number; cuentas: number }>();
    const categoriasMap = new Map<string, { total: number; unidades: number }>();
    const productosMap = new Map<
      number,
      { id_producto: number; nombre: string; categoria: string; unidades: number; total: number }
    >();

    const detalleFacturas: any[] = [];

    for (const f of facturas) {
      if (filtro.categoria) {
        const tieneCategoria = (f.pedidos || []).some((ped) =>
          (ped.items || []).some(
            (it) => it.producto?.categoria.toLowerCase() === filtro.categoria!.toLowerCase(),
          ),
        );
        if (!tieneCategoria) continue;
      }

      cuentasPagadas++;
      const vTotal = Number(f.valor_total);
      const vSubtotal = Number(f.valor);
      const vPropina = Number(f.propina);
      const canal = resolverCanalFactura(f);

      totalVentas += vTotal;
      totalSubtotal += vSubtotal;
      totalPropinas += vPropina;

      if (canal === 'salon') totalSalon += vTotal;
      else totalDomicilio += vTotal;

      const diaKey = formatoFechaCol(f.fecha_hora);
      const d = serieDiaMap.get(diaKey) || { total: 0, cuentas: 0 };
      d.total += vTotal;
      d.cuentas += 1;
      serieDiaMap.set(diaKey, d);

      // Detalle de ítems para categorías y ranking de productos
      for (const ped of f.pedidos) {
        for (const it of ped.items) {
          if (filtro.categoria && it.producto?.categoria.toLowerCase() !== filtro.categoria.toLowerCase()) {
            continue;
          }

          const cat = it.producto?.categoria || 'Sin Categoría';
          const catData = categoriasMap.get(cat) || { total: 0, unidades: 0 };
          const subtotalItem = it.cantidad * Number(it.precio_unitario);
          catData.total += subtotalItem;
          catData.unidades += it.cantidad;
          totalItemsCategorias += subtotalItem;
          categoriasMap.set(cat, catData);

          const prodId = it.id_producto;
          const prodData = productosMap.get(prodId) || {
            id_producto: prodId,
            nombre: it.producto?.nombre || `Producto #${prodId}`,
            categoria: cat,
            unidades: 0,
            total: 0,
          };
          prodData.unidades += it.cantidad;
          prodData.total += subtotalItem;
          productosMap.set(prodId, prodData);
        }
      }

      detalleFacturas.push({
        id_venta: f.id_venta,
        fecha_hora: f.fecha_hora,
        cliente_nombre: f.cliente_nombre || 'Cliente General',
        tipo_servicio: canal,
        mesa_numero: f.mesa?.numero || null,
        subtotal: vSubtotal,
        propina: vPropina,
        total: vTotal,
        medios_pago: f.pagos.map((p) => p.medioPago?.nombre || 'Efectivo').join(', '),
        atendido_por: f.usuario?.nombre || 'Cajero',
        observacion: f.observacion || undefined,
      });
    }

    totalVentas = redondearMoneda(totalVentas);
    totalSubtotal = redondearMoneda(totalSubtotal);
    totalPropinas = redondearMoneda(totalPropinas);
    totalSalon = redondearMoneda(totalSalon);
    totalDomicilio = redondearMoneda(totalDomicilio);
    totalItemsCategorias = redondearMoneda(totalItemsCategorias);

    const ticketPromedio = cuentasPagadas > 0 ? redondearMoneda(totalVentas / cuentasPagadas) : 0;

    const serieTemporal = Array.from(serieDiaMap.entries())
      .map(([fecha, datos]) => ({
        fecha,
        total_ventas: redondearMoneda(datos.total),
        cuentas_pagadas: datos.cuentas,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const desgloseCategorias = Array.from(categoriasMap.entries())
      .map(([categoria, datos]) => ({
        categoria,
        total: redondearMoneda(datos.total),
        unidades: datos.unidades,
        porcentaje:
          totalItemsCategorias > 0 ? redondearMoneda((datos.total / totalItemsCategorias) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const rankingProductos = Array.from(productosMap.values())
      .map((p) => ({
        ...p,
        total: redondearMoneda(p.total),
        precio_promedio: p.unidades > 0 ? redondearMoneda(p.total / p.unidades) : 0,
      }))
      .sort((a, b) => b.unidades - a.unidades);

    return {
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      resumen: {
        total_ventas: totalVentas,
        subtotal: totalSubtotal,
        total_propinas: totalPropinas,
        cuentas_pagadas: cuentasPagadas,
        ticket_promedio: ticketPromedio,
        total_salon: totalSalon,
        total_domicilio: totalDomicilio,
        porcentaje_salon: totalVentas > 0 ? redondearMoneda((totalSalon / totalVentas) * 100) : 0,
        porcentaje_domicilio: totalVentas > 0 ? redondearMoneda((totalDomicilio / totalVentas) * 100) : 0,
      },
      serie_temporal: serieTemporal,
      categorias: desgloseCategorias,
      ranking_productos: rankingProductos,
      detalle_facturas: detalleFacturas,
    };
  }

  /**
   * REPORTE 2: CAJA Y MEDIOS DE PAGO
   * Detalla ingresos y egresos por medio, histórico de turnos cerrados, diferencias físico vs teórico.
   */
  async obtenerReporteCajaMedios(filtro: FiltroFechasDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    // 1. Cajas con actividad o solapamiento dentro del rango (incluye turnos abiertos que iniciaron antes del rango)
    const cajas = await this.prisma.caja.findMany({
      where: {
        AND: [
          { fecha_apertura: { lte: fin } },
          {
            OR: [
              { fecha_cierre: { gte: inicio } },
              { estado: EstadoCaja.abierta },
            ],
          },
        ],
      },
      include: {
        usuarioApertura: { select: { nombre: true } },
        usuarioCierre: { select: { nombre: true } },
        facturas: {
          where: {
            estado: EstadoFactura.emitida,
            fecha_hora: { gte: inicio, lte: fin },
          },
          include: {
            pagos: { include: { medioPago: true } },
            pedidos: {
              include: {
                items: {
                  include: {
                    producto: { select: { costo: true } },
                  },
                },
              },
            },
          },
        },
        gastos: {
          where: {
            fecha_hora: { gte: inicio, lte: fin },
          },
          include: { medioPago: true, tipoGasto: true },
        },
      },
      orderBy: { fecha_apertura: 'desc' },
    });

    let totalRecaudoEfectivo = 0;
    let totalRecaudoTarjeta = 0;
    let totalRecaudoTransferencia = 0;

    let totalGastosEfectivo = 0;
    let totalGastosTarjeta = 0;
    let totalGastosTransferencia = 0;

    let totalCajasCerradas = 0;
    let totalExactas = 0;
    let totalSobrantes = 0;
    let totalFaltantes = 0;
    let sumaDiferencias = 0;
    let totalUtilidadDia = 0;
    let totalUtilidadNeta = 0;
    let cajaActualResumen: {
      id_caja: number;
      utilidad_del_dia: number;
      utilidad_neta: number;
      ventas_netas: number;
      total_gastos: number;
      costo_insumos: number;
      margen_utilidad_porcentaje: number;
    } | null = null;

    const turnosDetalle = cajas.map((c) => {
      const valorBase = redondearMoneda(Number(c.valor_inicial));
      let vEfectivo = 0;
      let vTarjeta = 0;
      let vTransferencia = 0;
      let totalVentasCaja = 0;
      let totalPropinasCaja = 0;
      let costoInsumosCaja = 0;

      for (const f of c.facturas) {
        totalVentasCaja += Number(f.valor_total);
        totalPropinasCaja += Number(f.propina || 0);
        for (const p of f.pagos) {
          const met = normalizarMedioPago(p.medioPago?.nombre);
          const m = Number(p.monto);
          if (met === 'efectivo') vEfectivo += m;
          else if (met === 'tarjeta') vTarjeta += m;
          else vTransferencia += m;
        }
        if (Array.isArray((f as any).pedidos)) {
          for (const ped of (f as any).pedidos) {
            if (Array.isArray(ped.items)) {
              for (const it of ped.items) {
                costoInsumosCaja += (Number(it.cantidad) || 0) * (Number(it.producto?.costo) || 0);
              }
            }
          }
        }
      }

      let gEfectivo = 0;
      let gTarjeta = 0;
      let gTransferencia = 0;
      let gTotal = 0;
      for (const g of c.gastos) {
        const m = Number(g.total);
        gTotal += m;
        const met = normalizarMedioPago(g.medioPago?.nombre);
        if (met === 'tarjeta') gTarjeta += m;
        else if (met === 'transferencia') gTransferencia += m;
        else gEfectivo += m;
      }

      const ventasNetasCaja = redondearMoneda(totalVentasCaja - totalPropinasCaja);
      const utilidadNeta = redondearMoneda(ventasNetasCaja - costoInsumosCaja - gTotal);
      const utilidadDelDia = utilidadNeta;
      const margenUtilidad =
        ventasNetasCaja > 0 ? redondearMoneda((utilidadDelDia / ventasNetasCaja) * 100) : 0;

      totalUtilidadDia += utilidadDelDia;
      totalUtilidadNeta += utilidadNeta;

      if (c.estado === EstadoCaja.abierta && !cajaActualResumen) {
        cajaActualResumen = {
          id_caja: c.id_caja,
          utilidad_del_dia: utilidadDelDia,
          utilidad_neta: utilidadNeta,
          ventas_netas: ventasNetasCaja,
          total_gastos: redondearMoneda(gTotal),
          costo_insumos: redondearMoneda(costoInsumosCaja),
          margen_utilidad_porcentaje: margenUtilidad,
        };
      }

      totalRecaudoEfectivo += vEfectivo;
      totalRecaudoTarjeta += vTarjeta;
      totalRecaudoTransferencia += vTransferencia;
      totalGastosEfectivo += gEfectivo;
      totalGastosTarjeta += gTarjeta;
      totalGastosTransferencia += gTransferencia;

      const vTeorico = c.valor_final_teorico !== null
        ? Number(c.valor_final_teorico)
        : redondearMoneda(valorBase + vEfectivo - gEfectivo);

      const vFisico = c.valor_final_fisico !== null ? Number(c.valor_final_fisico) : null;
      const dif = c.diferencia !== null ? Number(c.diferencia) : null;

      let tipoCuadre: 'exacto' | 'sobrante' | 'faltante' | 'en_progreso' = 'en_progreso';
      if (c.estado === EstadoCaja.cerrada) {
        totalCajasCerradas++;
        if (dif === null || Math.abs(dif) < 0.01) {
          tipoCuadre = 'exacto';
          totalExactas++;
        } else if (dif > 0) {
          tipoCuadre = 'sobrante';
          totalSobrantes++;
          sumaDiferencias += dif;
        } else {
          tipoCuadre = 'faltante';
          totalFaltantes++;
          sumaDiferencias += dif;
        }
      }

      return {
        id_caja: c.id_caja,
        estado: c.estado,
        fecha_apertura: c.fecha_apertura,
        fecha_cierre: c.fecha_cierre,
        cajero_apertura: c.usuarioApertura.nombre,
        cajero_cierre: c.usuarioCierre?.nombre || null,
        valor_inicial: valorBase,
        total_ventas: redondearMoneda(totalVentasCaja),
        ventas_netas: ventasNetasCaja,
        total_propinas: redondearMoneda(totalPropinasCaja),
        ventas_efectivo: redondearMoneda(vEfectivo),
        ventas_tarjeta: redondearMoneda(vTarjeta),
        ventas_transferencia: redondearMoneda(vTransferencia),
        total_gastos: redondearMoneda(gTotal),
        gastos_efectivo: redondearMoneda(gEfectivo),
        costo_insumos: redondearMoneda(costoInsumosCaja),
        utilidad_del_dia: utilidadDelDia,
        utilidad_neta: utilidadNeta,
        margen_utilidad_porcentaje: margenUtilidad,
        valor_final_teorico: redondearMoneda(vTeorico),
        valor_final_fisico: vFisico !== null ? redondearMoneda(vFisico) : null,
        diferencia: dif !== null ? redondearMoneda(dif) : null,
        tipo_cuadre: tipoCuadre,
        observacion: c.observacion || undefined,
      };
    });

    totalRecaudoEfectivo = redondearMoneda(totalRecaudoEfectivo);
    totalRecaudoTarjeta = redondearMoneda(totalRecaudoTarjeta);
    totalRecaudoTransferencia = redondearMoneda(totalRecaudoTransferencia);
    totalGastosEfectivo = redondearMoneda(totalGastosEfectivo);
    totalGastosTarjeta = redondearMoneda(totalGastosTarjeta);
    totalGastosTransferencia = redondearMoneda(totalGastosTransferencia);
    const totalVentasGlobal = totalRecaudoEfectivo + totalRecaudoTarjeta + totalRecaudoTransferencia;

    const desgloseMedios = [
      {
        medio: 'Efectivo',
        recaudo: totalRecaudoEfectivo,
        gastos: totalGastosEfectivo,
        neto: redondearMoneda(totalRecaudoEfectivo - totalGastosEfectivo),
        porcentaje_ventas: totalVentasGlobal > 0 ? redondearMoneda((totalRecaudoEfectivo / totalVentasGlobal) * 100) : 0,
      },
      {
        medio: 'Tarjeta',
        recaudo: totalRecaudoTarjeta,
        gastos: totalGastosTarjeta,
        neto: redondearMoneda(totalRecaudoTarjeta - totalGastosTarjeta),
        porcentaje_ventas: totalVentasGlobal > 0 ? redondearMoneda((totalRecaudoTarjeta / totalVentasGlobal) * 100) : 0,
      },
      {
        medio: 'Transferencia',
        recaudo: totalRecaudoTransferencia,
        gastos: totalGastosTransferencia,
        neto: redondearMoneda(totalRecaudoTransferencia - totalGastosTransferencia),
        porcentaje_ventas: totalVentasGlobal > 0 ? redondearMoneda((totalRecaudoTransferencia / totalVentasGlobal) * 100) : 0,
      },
    ];

    return {
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      resumen: {
        total_recaudo: totalVentasGlobal,
        total_efectivo_esperado_neto: redondearMoneda(totalRecaudoEfectivo - totalGastosEfectivo),
        total_utilidad_del_dia: redondearMoneda(totalUtilidadDia),
        total_utilidad_neta: redondearMoneda(totalUtilidadNeta),
        caja_actual: cajaActualResumen,
        total_cajas_analizadas: cajas.length,
        total_cajas_cerradas: totalCajasCerradas,
        cajas_exactas: totalExactas,
        cajas_sobrantes: totalSobrantes,
        cajas_faltantes: totalFaltantes,
        suma_diferencias: redondearMoneda(sumaDiferencias),
      },
      desglose_medios: desgloseMedios,
      turnos: turnosDetalle,
    };
  }

  /**
   * REPORTE 3: INVENTARIO Y STOCK
   * Muestra existencias actuales, valorización basada en costo actual, alertas y ajustes recientes.
   */
  async obtenerReporteInventario(filtro: FiltroInventarioDto) {
    const where: any = {};

    if (filtro.categoria) {
      where.categoria = { equals: filtro.categoria, mode: 'insensitive' };
    }

    if (filtro.controla_inventario !== undefined) {
      where.controla_inventario = filtro.controla_inventario;
    }

    if (filtro.busqueda?.trim()) {
      where.nombre = { contains: filtro.busqueda.trim(), mode: 'insensitive' };
    }

    if (filtro.solo_bajo_stock) {
      where.controla_inventario = true;
      where.cantidad_inventario = { gt: 0, lte: 5 };
    }

    if (filtro.solo_agotados) {
      where.controla_inventario = true;
      where.cantidad_inventario = { lte: 0 };
    }

    const productos = await this.prisma.producto.findMany({
      where,
      select: this.productoSelectMinimo,
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });

    let totalProductos = productos.length;
    let totalDisponibles = 0;
    let totalControlanStock = 0;
    let totalBajoStock = 0;
    let totalAgotados = 0;
    let valorTotalInventario = 0;
    let valorPotencialVenta = 0;

    const listaProductos = productos.map((p) => {
      const stock = p.cantidad_inventario;
      const costo = Number(p.costo);
      const precio = Number(p.precio_venta);

      if (p.disponible) totalDisponibles++;
      if (p.controla_inventario) {
        totalControlanStock++;
        if (stock <= 0) totalAgotados++;
        else if (stock <= 5) totalBajoStock++;

        const valorInv = Math.max(0, stock) * costo;
        const valorVta = Math.max(0, stock) * precio;
        valorTotalInventario += valorInv;
        valorPotencialVenta += valorVta;
      }

      let estadoStock: 'agotado' | 'bajo' | 'normal' | 'no_controlado' = 'no_controlado';
      if (p.controla_inventario) {
        if (stock <= 0) estadoStock = 'agotado';
        else if (stock <= 5) estadoStock = 'bajo';
        else estadoStock = 'normal';
      }

      return {
        id_producto: p.id_producto,
        nombre: p.nombre,
        categoria: p.categoria,
        controla_inventario: p.controla_inventario,
        cantidad_inventario: stock,
        disponible: p.disponible,
        costo_unitario: costo,
        precio_venta: precio,
        valor_inventario: redondearMoneda(Math.max(0, stock) * costo),
        estado_stock: estadoStock,
      };
    });

    const rangoAjustes = resolverRangoFechaOpcional({
      fecha_inicio: filtro.fecha_inicio,
      fecha_fin: filtro.fecha_fin,
    });

    // Movimientos de ajuste de inventario registrados en la bitácora (filtrados por fecha si se envía rango)
    const ajustesRecientes = await this.prisma.ajusteInventario.findMany({
      ...(rangoAjustes ? { where: { fecha_hora: rangoAjustes } } : {}),
      take: rangoAjustes ? 200 : 20,
      orderBy: { fecha_hora: 'desc' },
      include: {
        producto: { select: { nombre: true, categoria: true } },
        usuario: { select: { nombre: true } },
      },
    });

    const movimientosAjuste = ajustesRecientes.map((a) => ({
      id_ajuste: a.id_ajuste,
      fecha_hora: a.fecha_hora,
      producto: a.producto.nombre,
      categoria: a.producto.categoria,
      tipo_ajuste: a.tipo_ajuste,
      cantidad: a.cantidad,
      motivo: a.motivo,
      responsable: a.usuario.nombre,
    }));

    return {
      ...(rangoAjustes
        ? {
            periodo: {
              inicio: (rangoAjustes.gte ?? new Date(0)).toISOString(),
              fin: (rangoAjustes.lte ?? new Date()).toISOString(),
            },
          }
        : {}),
      resumen: {
        total_productos: totalProductos,
        total_disponibles: totalDisponibles,
        total_controlan_stock: totalControlanStock,
        total_bajo_stock: totalBajoStock,
        total_agotados: totalAgotados,
        valor_total_inventario: redondearMoneda(valorTotalInventario),
        valor_potencial_venta: redondearMoneda(valorPotencialVenta),
      },
      productos: listaProductos,
      ajustes_recientes: movimientosAjuste,
    };
  }

  /**
   * REPORTE 4: GASTOS OPERATIVOS
   * Detalle cronológico, categorización por tipo y medio de pago, y comparativas.
   */
  async obtenerReporteGastos(filtro: FiltroGastosDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    const where: any = {
      fecha_hora: { gte: inicio, lte: fin },
    };

    if (filtro.tipo_gasto) {
      where.tipoGasto = { nombre: { equals: filtro.tipo_gasto, mode: 'insensitive' } };
    }

    if (filtro.medio_pago) {
      where.medioPago = { nombre: { equals: filtro.medio_pago, mode: 'insensitive' } };
    }

    const gastos = await this.prisma.gasto.findMany({
      where,
      include: {
        tipoGasto: true,
        medioPago: true,
        usuario: { select: { nombre: true } },
        caja: { select: { id_caja: true, estado: true } },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    let totalGastos = 0;
    const tiposMap = new Map<string, { total: number; movimientos: number }>();
    const mediosMap = new Map<string, { total: number; movimientos: number }>();

    const detalleGastos = gastos.map((g) => {
      const monto = Number(g.total);
      totalGastos += monto;

      const tipo = g.tipoGasto?.nombre || 'Otros';
      const tData = tiposMap.get(tipo) || { total: 0, movimientos: 0 };
      tData.total += monto;
      tData.movimientos += 1;
      tiposMap.set(tipo, tData);

      const medio = etiquetaMedioPago(g.medioPago?.nombre);
      const mData = mediosMap.get(medio) || { total: 0, movimientos: 0 };
      mData.total += monto;
      mData.movimientos += 1;
      mediosMap.set(medio, mData);

      return {
        id_gasto: g.id_gasto,
        id_caja: g.id_caja,
        fecha_hora: g.fecha_hora,
        descripcion: g.descripcion,
        tipo_gasto: tipo,
        medio_pago: medio,
        total: redondearMoneda(monto),
        responsable: g.usuario?.nombre || 'Cajero',
        observacion: g.observacion || undefined,
      };
    });

    totalGastos = redondearMoneda(totalGastos);
    const cantidadMovimientos = gastos.length;
    const gastoPromedio = cantidadMovimientos > 0 ? redondearMoneda(totalGastos / cantidadMovimientos) : 0;

    const desgloseTipos = Array.from(tiposMap.entries())
      .map(([tipo, d]) => ({
        tipo,
        total: redondearMoneda(d.total),
        movimientos: d.movimientos,
        porcentaje: totalGastos > 0 ? redondearMoneda((d.total / totalGastos) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const desgloseMedios = Array.from(mediosMap.entries())
      .map(([medio, d]) => ({
        medio,
        total: redondearMoneda(d.total),
        movimientos: d.movimientos,
        porcentaje: totalGastos > 0 ? redondearMoneda((d.total / totalGastos) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      resumen: {
        total_gastos: totalGastos,
        cantidad_movimientos: cantidadMovimientos,
        gasto_promedio: gastoPromedio,
      },
      desglose_por_tipo: desgloseTipos,
      desglose_por_medio: desgloseMedios,
      detalle_gastos: detalleGastos,
    };
  }

  /**
   * REPORTE 5: RENTABILIDAD POR PRODUCTO
   * Cruza facturas emitidas y costo vigente en el catálogo para calcular utilidad y margen bruto.
   */
  async obtenerReporteRentabilidad(filtro: FiltroRentabilidadDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    const facturas = await this.prisma.factura.findMany({
      where: {
        estado: EstadoFactura.emitida,
        fecha_hora: { gte: inicio, lte: fin },
      },
      include: {
        pedidos: {
          include: {
            items: {
              include: {
                producto: { select: this.productoSelectMinimo },
              },
            },
          },
        },
      },
    });

    const productosRentabilidadMap = new Map<
      number,
      {
        id_producto: number;
        nombre: string;
        categoria: string;
        unidades_vendidas: number;
        ingresos_totales: number;
        costo_unitario_actual: number;
        costo_total_estimado: number;
        utilidad_bruta: number;
        margen_bruto_porcentaje: number;
      }
    >();

    let totalIngresos = 0;
    let totalCostos = 0;

    for (const f of facturas) {
      for (const ped of f.pedidos) {
        for (const it of ped.items) {
          if (filtro.categoria && it.producto?.categoria.toLowerCase() !== filtro.categoria.toLowerCase()) {
            continue;
          }

          const prod = it.producto;
          if (!prod) continue;

          const prodId = prod.id_producto;
          const cant = it.cantidad;
          const precioCobrado = Number(it.precio_unitario);
          const ingresoItem = cant * precioCobrado;
          const costoUnit = Number(prod.costo);
          const costoItem = cant * costoUnit;

          totalIngresos += ingresoItem;
          totalCostos += costoItem;

          const exist = productosRentabilidadMap.get(prodId) || {
            id_producto: prodId,
            nombre: prod.nombre,
            categoria: prod.categoria,
            unidades_vendidas: 0,
            ingresos_totales: 0,
            costo_unitario_actual: costoUnit,
            costo_total_estimado: 0,
            utilidad_bruta: 0,
            margen_bruto_porcentaje: 0,
          };

          exist.unidades_vendidas += cant;
          exist.ingresos_totales += ingresoItem;
          exist.costo_total_estimado += costoItem;
          productosRentabilidadMap.set(prodId, exist);
        }
      }
    }

    totalIngresos = redondearMoneda(totalIngresos);
    totalCostos = redondearMoneda(totalCostos);
    const utilidadBrutaTotal = redondearMoneda(totalIngresos - totalCostos);
    const margenBrutoPromedio = totalIngresos > 0 ? redondearMoneda((utilidadBrutaTotal / totalIngresos) * 100) : 0;

    const rankingRentabilidad = Array.from(productosRentabilidadMap.values())
      .map((p) => {
        const util = p.ingresos_totales - p.costo_total_estimado;
        const margen = p.ingresos_totales > 0 ? (util / p.ingresos_totales) * 100 : 0;
        return {
          ...p,
          ingresos_totales: redondearMoneda(p.ingresos_totales),
          costo_total_estimado: redondearMoneda(p.costo_total_estimado),
          utilidad_bruta: redondearMoneda(util),
          margen_bruto_porcentaje: redondearMoneda(margen),
        };
      })
      .sort((a, b) => b.utilidad_bruta - a.utilidad_bruta);

    return {
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      nota_metodologica:
        'Cálculo basado en el costo unitario actualmente registrado en el catálogo de productos. Refleja la utilidad bruta (Ingresos - Costo de ventas) y no la utilidad neta contable del restaurante.',
      resumen: {
        total_ingresos: totalIngresos,
        total_costos_estimados: totalCostos,
        utilidad_bruta_total: utilidadBrutaTotal,
        margen_bruto_promedio_porcentaje: margenBrutoPromedio,
      },
      productos: rankingRentabilidad,
    };
  }

  /**
   * REPORTE 6: OPERACIÓN Y PEDIDOS
   * Métricas operativas, pedidos por tipo y estado, distribución horaria (horas pico) y cancelaciones.
   */
  async obtenerReporteOperacion(filtro: FiltroOperacionDto) {
    const { inicio, fin } = resolverRangoFechas(filtro.fecha_inicio, filtro.fecha_fin);

    const where: any = {
      fecha_hora: { gte: inicio, lte: fin },
    };

    if (filtro.tipo_servicio) where.tipo = filtro.tipo_servicio;
    if (filtro.estado) where.estado = filtro.estado;

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        factura: { select: { estado: true, motivo_anulacion: true } },
        items: {
          include: {
            producto: { select: { id_producto: true, nombre: true, categoria: true } },
          },
        },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    let totalPedidos = pedidos.length;
    let pedidosEnviados = 0;
    let pedidosCerrados = 0;
    let pedidosCancelados = 0;
    let pedidosSalon = 0;
    let pedidosDomicilio = 0;

    const distribucionHoraria = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      pedidos: 0,
      etiqueta: `${String(hora).padStart(2, '0')}:00`,
    }));

    const productosCocinaMap = new Map<number, { nombre: string; categoria: string; cantidad: number }>();
    const canceladosDetalle: any[] = [];

    for (const ped of pedidos) {
      if (ped.estado === EstadoPedido.enviada) pedidosEnviados++;
      else if (ped.estado === EstadoPedido.cerrada) pedidosCerrados++;
      else if (ped.estado === EstadoPedido.cancelada) {
        pedidosCancelados++;
        const motivoAnulacionFactura =
          (ped as any).factura?.estado === EstadoFactura.anulada &&
          (ped as any).factura?.motivo_anulacion
            ? `Factura anulada: ${(ped as any).factura.motivo_anulacion}`
            : null;
        canceladosDetalle.push({
          id_pedido: ped.id_pedido,
          numero_pedido: ped.numero_pedido,
          fecha_hora: ped.fecha_hora,
          tipo: ped.tipo,
          mesa_numero: ped.mesa?.numero || null,
          usuario: ped.usuario?.nombre || 'Mesero',
          observacion: motivoAnulacionFactura || ped.observacion || 'Sin motivo especificado',
        });
      }

      if (ped.tipo === TipoPedido.salon) pedidosSalon++;
      else pedidosDomicilio++;

      // Franja horaria
      const h = obtenerHoraCol(ped.fecha_hora);
      if (h >= 0 && h < 24) {
        distribucionHoraria[h].pedidos += 1;
      }

      // Demanda en cocina (no cancelados) agrupada por id_producto
      if (ped.estado !== EstadoPedido.cancelada) {
        for (const it of ped.items) {
          const prodKey = it.id_producto;
          const p = productosCocinaMap.get(prodKey) || {
            nombre: it.producto?.nombre || `Producto #${prodKey}`,
            categoria: it.producto?.categoria || 'General',
            cantidad: 0,
          };
          p.cantidad += it.cantidad;
          productosCocinaMap.set(prodKey, p);
        }
      }
    }

    const tasaCancelacion = totalPedidos > 0 ? redondearMoneda((pedidosCancelados / totalPedidos) * 100) : 0;

    const topProductosCocina = Array.from(productosCocinaMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return {
      periodo: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      resumen: {
        total_pedidos: totalPedidos,
        pedidos_enviados_activos: pedidosEnviados,
        pedidos_cerrados: pedidosCerrados,
        pedidos_cancelados: pedidosCancelados,
        tasa_cancelacion_porcentaje: tasaCancelacion,
        pedidos_salon: pedidosSalon,
        pedidos_domicilio: pedidosDomicilio,
      },
      distribucion_horaria: distribucionHoraria,
      top_productos_cocina: topProductosCocina,
      pedidos_cancelados_detalle: canceladosDetalle,
    };
  }
}
