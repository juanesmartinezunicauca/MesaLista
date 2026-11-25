import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Domicilio } from '../../../core/models';
import { ImpresionTermicaService } from '../../../core/services/print/impresion-termica.service';

export interface DetalleDomiDialogData {
  pedido: Domicilio;
}

export type DetalleDomiAccion =
  | 'cerrar'
  | 'aceptar'
  | 'rechazar'
  | 'despachar'
  | 'facturar'
  | 'cerrar_pedido'
  | 'reasignar_repartidor';

@Component({
  selector: 'app-detalle-domi-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './detalle-domi-dialog.html',
  styleUrl: './detalle-domi-dialog.scss',
})
export class DetalleDomiDialogComponent {
  data = inject<DetalleDomiDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<DetalleDomiDialogComponent>);
  private impresionTermica = inject(ImpresionTermicaService);

  pedido = this.data.pedido;

  totalItems = computed(() => {
    return (this.pedido.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);
  });

  cerrar(): void {
    this.dialogRef.close({ accion: 'cerrar' });
  }

  aceptar(): void {
    this.dialogRef.close({ accion: 'aceptar', pedido: this.pedido });
  }

  rechazar(): void {
    this.dialogRef.close({ accion: 'rechazar', pedido: this.pedido });
  }

  despachar(): void {
    this.dialogRef.close({ accion: 'despachar', pedido: this.pedido });
  }

  facturar(): void {
    this.dialogRef.close({ accion: 'facturar', pedido: this.pedido });
  }

  cerrarPedido(): void {
    this.dialogRef.close({ accion: 'cerrar_pedido', pedido: this.pedido });
  }

  reasignarRepartidor(): void {
    this.dialogRef.close({ accion: 'reasignar_repartidor', pedido: this.pedido });
  }

  imprimirTicketCliente(): void {
    const p = this.pedido;
    const costoEnvio = Number(p.costo_envio ?? 0);
    const items = (p.items || []).map((it) => {
      const unit = Number(it.precio_unitario || it.producto?.precio_venta || 0);
      return {
        nombre: it.producto?.nombre || `Producto #${it.id_producto}`,
        cantidad: it.cantidad,
        precio_unitario: unit,
        subtotal: it.cantidad * unit,
        ingredientes_removidos: it.ingredientes_removidos,
        observacion: it.observacion,
      };
    });
    const subtotalProductos =
      p.subtotalProductos !== undefined
        ? Number(p.subtotalProductos)
        : items.reduce((acc, it) => acc + it.subtotal, 0);
    const propina = Number(p.factura?.propina || 0);
    const total = Number(p.totalCalculado || subtotalProductos + costoEnvio + propina);

    this.impresionTermica.imprimirFacturaCliente({
      tipo: 'domicilio',
      numeroFactura: p.id_factura ?? null,
      numeroPedido: p.numero_pedido,
      fecha: p.fecha_hora || new Date(),
      cliente: {
        nombre: p.cliente?.nombre,
        telefono: p.cliente?.telefono,
        direccion: p.cliente?.direccion,
        zona: p.zona_nombre || undefined,
      },
      items,
      subtotal: subtotalProductos,
      costoEnvio,
      propina,
      total,
      formaPago: p.metodo_pago || 'Efectivo',
      observacion: p.observacion || null,
      esPrecuenta: !p.id_factura,
    });
  }

  imprimirComandaCocina(): void {
    const p = this.pedido;
    this.impresionTermica.imprimirComandaCocina({
      tipo: 'domicilio',
      numeroPedido: p.numero_pedido,
      clienteNombre: p.cliente?.nombre || null,
      zona: p.zona_nombre || null,
      fecha: p.fecha_hora || new Date(),
      items: (p.items || []).map((it) => ({
        nombre: it.producto?.nombre || `Producto #${it.id_producto}`,
        cantidad: it.cantidad,
        ingredientes_removidos: it.ingredientes_removidos,
        observacion: it.observacion,
      })),
      observacionGeneral: p.observacion || null,
    });
  }
}
