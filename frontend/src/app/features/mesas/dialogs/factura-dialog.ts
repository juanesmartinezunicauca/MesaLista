import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Mesa } from '../models/mesa.model';
import {
  MetodoPagoTipo,
  PagoDetalle,
  FacturaCobroResult,
  ItemConsolidado,
} from '../models/factura.model';

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
  ],
  templateUrl: './factura-dialog.html',
  styleUrl: './factura-dialog.scss',
})
export class FacturaDialogComponent {
  data = inject<{ mesa: Mesa }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<FacturaDialogComponent>);

  fechaActual = new Date();
  folioId = Math.floor(1000 + Math.random() * 9000);

  // Estados de Pago y Propinas
  metodoPago = signal<MetodoPagoTipo>('efectivo');
  tipoPropina = signal<'cero' | 'diez' | 'personalizada'>('diez');
  propinaPersonalizada = signal<number>(0);
  efectivoRecibido = signal<number>(0);

  // Desglose para pagos mixtos
  montoEfectivo = signal<number>(0);
  montoTarjeta = signal<number>(0);
  montoTransferencia = signal<number>(0);

  // Consolidación de todos los ítems de todos los pedidos de la mesa
  itemsConsolidados = computed<ItemConsolidado[]>(() => {
    const items: ItemConsolidado[] = [];

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

    return items;
  });

  subtotal = computed(() => {
    const items = this.itemsConsolidados();
    if (items.length > 0) {
      return items.reduce((acc, i) => acc + i.subtotal, 0);
    }
    return this.data.mesa.total_acumulado || 0;
  });

  propinaDiez = computed(() => Math.round(this.subtotal() * 0.1));

  montoPropina = computed(() => {
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

  totalFinal = computed(() => this.subtotal() + this.montoPropina());

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
      return this.efectivoRecibido() >= this.totalFinal();
    }

    return true;
  });

  seleccionarMetodo(metodo: MetodoPagoTipo): void {
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
    const isChecked = (event.target as HTMLInputElement).checked;
    this.tipoPropina.set(isChecked ? 'diez' : 'cero');
  }

  setEfectivoExacto(): void {
    this.efectivoRecibido.set(this.totalFinal());
  }

  imprimirPrecuenta(): void {
    window.print();
  }

  cerrarSinCobrar(): void {
    this.dialogRef.close(null);
  }

  confirmarCobro(): void {
    if (!this.puedeCobrar()) return;

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
    };

    this.dialogRef.close(resultado);
  }
}
