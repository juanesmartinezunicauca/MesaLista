import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Mesa } from '../models/mesa.model';
import {
  MetodoPagoTipo,
  PagoDetalle,
  FacturaCobroResult,
  ItemConsolidado,
} from '../models/factura.model';
import {
  AnchoPapelTermico,
  ImpresionTermicaService,
} from '../../../core/services/print/impresion-termica.service';

// Re-exportar tipos para mantener total compatibilidad hacia atrás
export * from '../models/factura.model';

@Component({
  selector: 'app-factura-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './factura-dialog.html',
  styleUrl: './factura-dialog.scss',
})
export class FacturaDialogComponent {
  data = inject<{ mesa?: Mesa; pedido?: any }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<FacturaDialogComponent>);
  impresionTermica = inject(ImpresionTermicaService);

  fechaActual = new Date();
  folioId = Math.floor(1000 + Math.random() * 9000);

  // Preferencias de impresión térmica (80mm / 58mm)
  imprimirClienteAlCobrar = signal<boolean>(
    this.impresionTermica.config().imprimirClienteAlCobrar,
  );
  imprimirCocinaAlCobrar = signal<boolean>(
    this.impresionTermica.config().imprimirCocinaAlCobrar,
  );
  mostrarConfigTicket = signal<boolean>(false);

  // Estados de Pago y Propinas
  esDomicilio = computed(() => Boolean(this.data?.pedido));

  private inicializarMetodoPago(): MetodoPagoTipo {
    if (this.data?.pedido) {
      const p = this.data.pedido;
      const raw = (
        p.metodo_pago ||
        p.factura?.pagos?.[0]?.medioPago?.nombre ||
        p.observacion_raw?.match(/\[PAGO:([^\]]+)\]/i)?.[1]?.trim() ||
        p.observacion?.match(/\[PAGO:([^\]]+)\]/i)?.[1]?.trim() ||
        'efectivo'
      ).toLowerCase();

      if (raw.includes('transf')) return 'transferencia';
      if (raw.includes('tarj')) return 'tarjeta';
      return 'efectivo';
    }
    return 'efectivo';
  }

  metodoPago = signal<MetodoPagoTipo>(this.inicializarMetodoPago());

  metodoPagoNombre = computed<string>(() => {
    switch (this.metodoPago()) {
      case 'transferencia':
        return 'Transferencia Electrónica';
      case 'tarjeta':
        return 'Tarjeta Débito / Crédito';
      case 'mixto':
        return 'Pago Mixto';
      case 'efectivo':
      default:
        return 'Efectivo';
    }
  });

  tipoPropina = signal<'cero' | 'diez' | 'personalizada'>('cero');
  propinaPersonalizada = signal<number>(0);
  efectivoRecibido = signal<number>(0);

  costoEnvio = computed<number>(() => {
    if (!this.data?.pedido) return 0;
    const p = this.data.pedido;
    if (p.costo_envio !== undefined && p.costo_envio !== null) return Number(p.costo_envio);
    const raw = p.observacion_raw || p.observacion || '';
    const match = raw.match(/\[ENVIO:([^\]]+)\]/i);
    if (!match) return 0;
    const digitos = match[1].replace(/\D/g, '');
    return digitos ? Number.parseInt(digitos, 10) : 0;
  });

  zonaNombre = computed<string>(() => {
    if (!this.data?.pedido) return '';
    const p = this.data.pedido;
    if (p.zona_nombre) return p.zona_nombre;
    const raw = p.observacion_raw || p.observacion || '';
    const match = raw.match(/\[ZONA:([^\]]+)\]/i);
    return match ? match[1].trim() : '';
  });

  // Desglose para pagos mixtos
  montoEfectivo = signal<number>(0);
  montoTarjeta = signal<number>(0);
  montoTransferencia = signal<number>(0);

  constructor() {
    // Si es domicilio o efectivo, precargar el valor total en efectivoRecibido
    setTimeout(() => {
      if (this.metodoPago() === 'efectivo') {
        this.efectivoRecibido.set(this.totalFinal());
      }
    });
  }

  // Consolidación de todos los ítems de todos los pedidos de la mesa o domicilio
  itemsConsolidados = computed<ItemConsolidado[]>(() => {
    const items: ItemConsolidado[] = [];

    if (this.data?.mesa) {
      const pedidos = this.data.mesa.pedidos || [];
      for (const pedido of pedidos) {
        for (const item of pedido.items || []) {
          const notas: string[] = [];
          if (item.ingredientes_removidos && item.ingredientes_removidos.length > 0) {
            notas.push(`Sin: ${item.ingredientes_removidos.join(', ')}`);
          }
          if (item.observacion) {
            notas.push(item.observacion);
          }

          const existing = items.find(
            (i) =>
              i.nombre === item.nombre &&
              i.precio_unitario === item.precio_unitario &&
              i.notas.join('|') === notas.join('|')
          );

          if (existing) {
            existing.cantidad += item.cantidad;
            existing.subtotal += item.subtotal;
          } else {
            items.push({
              nombre: item.nombre || `Producto #${item.id_producto}`,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              subtotal: item.subtotal,
              notas,
            });
          }
        }
      }
    } else if (this.data?.pedido) {
      const pedido = this.data.pedido;
      for (const item of pedido.items || []) {
        const notas: string[] = [];
        if (item.ingredientes_removidos) {
          notas.push(item.ingredientes_removidos);
        }
        if (item.observacion) {
          notas.push(item.observacion);
        }
        const unit = Number(item.precio_unitario || item.producto?.precio_venta || 0);
        items.push({
          nombre: item.producto?.nombre || item.nombre || `Producto #${item.id_producto}`,
          cantidad: item.cantidad,
          precio_unitario: unit,
          subtotal: item.cantidad * unit,
          notas,
        });
      }
    }

    return items;
  });

  subtotal = computed(() => {
    const items = this.itemsConsolidados();
    if (items.length > 0) {
      return items.reduce((acc, i) => acc + i.subtotal, 0);
    }
    if (this.data?.mesa) {
      return this.data.mesa.total_acumulado || 0;
    }
    if (this.data?.pedido) {
      if (this.data.pedido.subtotalProductos !== undefined) {
        return Number(this.data.pedido.subtotalProductos);
      }
      return Math.max(0, Number(this.data.pedido.totalCalculado || 0) - this.costoEnvio());
    }
    return 0;
  });

  propinaDiez = computed(() => {
    if (this.esDomicilio()) return 0;
    return Math.round(this.subtotal() * 0.1);
  });

  montoPropina = computed(() => {
    if (this.esDomicilio()) {
      return Number(this.data?.pedido?.factura?.propina || 0);
    }
    switch (this.tipoPropina()) {
      case 'cero':
        return 0;
      case 'diez':
        return this.propinaDiez();
      case 'personalizada':
        return Math.max(0, this.propinaPersonalizada());
      default:
        return 0;
    }
  });

  totalFinal = computed(() => this.subtotal() + this.costoEnvio() + this.montoPropina());

  // Cálculos para pago mixto
  totalAsignado = computed(() => {
    if (this.metodoPago() !== 'mixto') return this.totalFinal();
    return this.montoEfectivo() + this.montoTarjeta() + this.montoTransferencia();
  });

  diferenciaAsignacion = computed(() => this.totalFinal() - this.totalAsignado());

  asignacionCompleta = computed(() => this.totalAsignado() === this.totalFinal());

  cambioVueltos = computed(() => {
    const total = this.totalFinal();
    const recibido = this.efectivoRecibido();
    if (this.metodoPago() === 'mixto') {
      return Math.max(0, recibido - this.montoEfectivo());
    }
    return Math.max(0, recibido - total);
  });

  puedeCobrar = computed(() => {
    if (this.totalFinal() <= 0) return true;

    if (this.metodoPago() === 'mixto') {
      if (!this.asignacionCompleta()) return false;
      if (this.montoEfectivo() > 0) {
        return this.efectivoRecibido() >= this.montoEfectivo();
      }
      return true;
    }

    if (this.metodoPago() === 'efectivo') {
      if (this.esDomicilio() && this.efectivoRecibido() === 0) {
        return true;
      }
      return this.efectivoRecibido() >= this.totalFinal();
    }

    return true;
  });

  seleccionarMetodo(metodo: MetodoPagoTipo): void {
    if (this.esDomicilio()) return; // En domicilios se respeta la forma de pago establecida por el cliente

    this.metodoPago.set(metodo);

    if (metodo === 'efectivo' && this.efectivoRecibido() === 0) {
      this.efectivoRecibido.set(this.totalFinal());
    }

    if (metodo === 'mixto') {
      // Iniciar con valores en 0 si no se han configurado
      if (this.totalAsignado() === 0) {
        this.montoEfectivo.set(0);
        this.montoTarjeta.set(0);
        this.montoTransferencia.set(0);
      }
    }
  }

  completarMonto(metodo: 'efectivo' | 'tarjeta' | 'transferencia'): void {
    const faltante = this.diferenciaAsignacion();
    if (faltante <= 0) return;

    if (metodo === 'efectivo') {
      this.montoEfectivo.update((val) => val + faltante);
      if (this.efectivoRecibido() === 0) {
        this.efectivoRecibido.set(this.montoEfectivo());
      }
    } else if (metodo === 'tarjeta') {
      this.montoTarjeta.update((val) => val + faltante);
    } else if (metodo === 'transferencia') {
      this.montoTransferencia.update((val) => val + faltante);
    }
  }

  setTipoPropina(tipo: 'cero' | 'diez' | 'personalizada'): void {
    this.tipoPropina.set(tipo);
  }

  togglePropinaDiez(event: Event): void {
    if (this.esDomicilio()) return;
    const isChecked = (event.target as HTMLInputElement).checked;
    this.tipoPropina.set(isChecked ? 'diez' : 'cero');
  }

  setEfectivoExacto(): void {
    this.efectivoRecibido.set(this.totalFinal());
  }

  toggleImprimirCliente(event?: Event): void {
    const checked = event
      ? (event.target as HTMLInputElement).checked
      : !this.imprimirClienteAlCobrar();
    this.imprimirClienteAlCobrar.set(checked);
    this.impresionTermica.actualizarConfiguracion({ imprimirClienteAlCobrar: checked });
  }

  toggleImprimirCocina(event?: Event): void {
    const checked = event
      ? (event.target as HTMLInputElement).checked
      : !this.imprimirCocinaAlCobrar();
    this.imprimirCocinaAlCobrar.set(checked);
    this.impresionTermica.actualizarConfiguracion({ imprimirCocinaAlCobrar: checked });
  }

  actualizarNombreComercio(valor: string): void {
    this.impresionTermica.actualizarConfiguracion({
      nombreComercio: valor.trim() || "LUIGIE'S",
    });
  }

  actualizarDireccionYNit(valor: string): void {
    this.impresionTermica.actualizarConfiguracion({
      direccionYNit: valor.trim() || 'POPAYÁN, CAUCA — RESTAURANTE NOCTURNO',
    });
  }

  seleccionarAnchoPapel(ancho: AnchoPapelTermico): void {
    this.impresionTermica.actualizarConfiguracion({ anchoPapel: ancho });
  }

  private construirPagosDetalle(): Array<{ metodo: string; monto: number }> {
    if (this.metodoPago() === 'mixto') {
      const lista: Array<{ metodo: string; monto: number }> = [];
      if (this.montoEfectivo() > 0) lista.push({ metodo: 'Efectivo', monto: this.montoEfectivo() });
      if (this.montoTarjeta() > 0) lista.push({ metodo: 'Tarjeta', monto: this.montoTarjeta() });
      if (this.montoTransferencia() > 0) {
        lista.push({ metodo: 'Transferencia', monto: this.montoTransferencia() });
      }
      return lista;
    }
    return [{ metodo: this.metodoPagoNombre(), monto: this.totalFinal() }];
  }

  imprimirFacturaCliente(numeroFactura?: number | null): void {
    const p = this.data?.pedido;
    const mesa = this.data?.mesa;
    this.impresionTermica.imprimirFacturaCliente({
      tipo: this.esDomicilio() ? 'domicilio' : 'salon',
      numeroFactura: numeroFactura ?? p?.id_factura ?? null,
      numeroPedido: p?.numero_pedido ?? null,
      numeroMesa: mesa?.numero ?? null,
      mesero: mesa?.mesero_actual ?? null,
      fecha: new Date(),
      cliente: p
        ? {
            nombre: p.cliente?.nombre || p.cliente_nombre,
            telefono: p.cliente?.telefono || p.cliente_telefono,
            direccion: p.cliente?.direccion || p.cliente_direccion,
            zona: this.zonaNombre() || undefined,
          }
        : null,
      items: this.itemsConsolidados().map((it) => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal,
        notas: it.notas,
      })),
      subtotal: this.subtotal(),
      costoEnvio: this.costoEnvio(),
      propina: this.montoPropina(),
      total: this.totalFinal(),
      formaPago: this.metodoPagoNombre(),
      pagosDetalle: this.construirPagosDetalle(),
      efectivoRecibido:
        this.metodoPago() === 'efectivo' || (this.metodoPago() === 'mixto' && this.montoEfectivo() > 0)
          ? this.efectivoRecibido()
          : undefined,
      cambio:
        this.metodoPago() === 'efectivo' || (this.metodoPago() === 'mixto' && this.montoEfectivo() > 0)
          ? this.cambioVueltos()
          : undefined,
      observacion: p?.observacion || null,
      esPrecuenta: !numeroFactura && !p?.id_factura,
    });
  }

  imprimirComandaCocina(): void {
    const p = this.data?.pedido;
    const mesa = this.data?.mesa;
    const obsMesa = mesa?.pedidos
      ?.map((ped) => ped.observacion)
      .filter(Boolean)
      .join(' | ');

    this.impresionTermica.imprimirComandaCocina({
      tipo: this.esDomicilio() ? 'domicilio' : 'salon',
      numeroPedido: p?.numero_pedido ?? mesa?.pedidos?.[0]?.numero_pedido ?? null,
      numeroMesa: mesa?.numero ?? null,
      mesero: mesa?.mesero_actual ?? null,
      clienteNombre: p ? p.cliente?.nombre || p.cliente_nombre || null : null,
      zona: this.zonaNombre() || null,
      fecha: new Date(),
      items: this.itemsConsolidados().map((it) => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        notas: it.notas,
      })),
      observacionGeneral: p?.observacion || obsMesa || null,
    });
  }

  imprimirPrecuenta(): void {
    this.imprimirFacturaCliente();
  }

  cerrarSinCobrar(): void {
    this.dialogRef.close(null);
  }

  confirmarCobro(): void {
    if (!this.puedeCobrar()) return;

    if (this.metodoPago() === 'efectivo' && this.efectivoRecibido() < this.totalFinal()) {
      this.efectivoRecibido.set(this.totalFinal());
    }

    const pagos: PagoDetalle[] = [];

    if (this.metodoPago() === 'mixto') {
      if (this.montoEfectivo() > 0) {
        pagos.push({ metodo: 'efectivo', monto: this.montoEfectivo() });
      }
      if (this.montoTarjeta() > 0) {
        pagos.push({ metodo: 'tarjeta', monto: this.montoTarjeta() });
      }
      if (this.montoTransferencia() > 0) {
        pagos.push({ metodo: 'transferencia', monto: this.montoTransferencia() });
      }
    } else {
      pagos.push({ metodo: this.metodoPago(), monto: this.totalFinal() });
    }

    const resultado: FacturaCobroResult = {
      cobrado: true,
      metodoPago: this.metodoPago(),
      pagos,
      subtotal: this.subtotal(),
      propina: this.montoPropina(),
      total: this.totalFinal(),
      efectivoRecibido:
        this.metodoPago() === 'efectivo' || (this.metodoPago() === 'mixto' && this.montoEfectivo() > 0)
          ? this.efectivoRecibido()
          : undefined,
      cambio:
        this.metodoPago() === 'efectivo' || (this.metodoPago() === 'mixto' && this.montoEfectivo() > 0)
          ? this.cambioVueltos()
          : undefined,
      imprimirCliente: this.imprimirClienteAlCobrar(),
      imprimirCocina: this.imprimirCocinaAlCobrar(),
    };

    this.dialogRef.close(resultado);
  }
}
