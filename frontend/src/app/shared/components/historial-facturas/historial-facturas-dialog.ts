import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { FacturacionApiService, UpdateFacturaPayload } from '../../../core/services/api/facturacion-api.service';

@Component({
  selector: 'app-historial-facturas-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './historial-facturas-dialog.html',
  styleUrl: './historial-facturas-dialog.scss',
})
export class HistorialFacturasDialogComponent implements OnInit {
  private facturacionApi = inject(FacturacionApiService);
  private dialogRef = inject(MatDialogRef<HistorialFacturasDialogComponent>);
  private snackBar = inject(MatSnackBar);

  facturas = signal<any[]>([]);
  cargando = signal<boolean>(false);
  filtroTipo = signal<string>('todos');
  busqueda = signal<string>('');

  // Estado de edición de una factura específica
  facturaEditando = signal<any | null>(null);
  editMedioPago = signal<string>('Efectivo');
  editMontoEfectivo = signal<number>(0);
  editMontoTarjeta = signal<number>(0);
  editMontoTransferencia = signal<number>(0);
  editPropina = signal<number>(0);
  editObservacion = signal<string>('');
  guardandoEdicion = signal<boolean>(false);

  facturasFiltradas = computed(() => {
    let list = this.facturas();
    const tipo = this.filtroTipo();
    const query = this.busqueda().trim().toLowerCase();

    if (tipo === 'domicilio') {
      list = list.filter((f) => !f.id_mesa);
    } else if (tipo === 'salon') {
      list = list.filter((f) => !!f.id_mesa);
    }

    if (query) {
      list = list.filter((f) => {
        const clienteNom = f.cliente?.nombre?.toLowerCase() || '';
        const clienteTel = f.cliente?.telefono?.toLowerCase() || '';
        const mesaNum = f.mesa ? `mesa ${f.mesa.numero}` : '';
        const folio = `#fac-${f.id_venta}`.toLowerCase();
        const obs = f.observacion?.toLowerCase() || '';
        return (
          clienteNom.includes(query) ||
          clienteTel.includes(query) ||
          mesaNum.includes(query) ||
          folio.includes(query) ||
          obs.includes(query)
        );
      });
    }

    return list.sort(
      (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
    );
  });

  ngOnInit(): void {
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.cargando.set(true);
    this.facturacionApi.obtenerTodas().subscribe({
      next: (data) => {
        this.facturas.set(data || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar historial de facturas.', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  cambiarFiltro(tipo: string): void {
    this.filtroTipo.set(tipo);
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  iniciarEdicion(factura: any): void {
    this.facturaEditando.set(factura);
    this.editPropina.set(Number(factura.propina) || 0);
    this.editObservacion.set(factura.observacion || '');

    // Analizar medios de pago actuales
    const pagos = factura.pagos || [];
    if (pagos.length === 1) {
      const medio = pagos[0].medioPago?.nombre || 'Efectivo';
      this.editMedioPago.set(medio);
    } else if (pagos.length > 1) {
      this.editMedioPago.set('Mixto');
      let ef = 0, tj = 0, tr = 0;
      for (const p of pagos) {
        const m = (p.medioPago?.nombre || '').toLowerCase();
        const amt = Number(p.monto) || 0;
        if (m.includes('efectivo')) ef += amt;
        else if (m.includes('tarjeta')) tj += amt;
        else tr += amt;
      }
      this.editMontoEfectivo.set(ef);
      this.editMontoTarjeta.set(tj);
      this.editMontoTransferencia.set(tr);
    } else {
      this.editMedioPago.set('Efectivo');
    }
  }

  cancelarEdicion(): void {
    this.facturaEditando.set(null);
  }

  guardarEdicion(): void {
    const factura = this.facturaEditando();
    if (!factura || this.guardandoEdicion()) return;

    const valorBase = Number(factura.valor);
    const nuevaPropina = Number(this.editPropina()) || 0;
    const totalFactura = valorBase + nuevaPropina;

    let pagosPayload: Array<{ medio_pago: string; monto: number }> = [];

    if (this.editMedioPago() === 'Mixto') {
      const ef = Number(this.editMontoEfectivo()) || 0;
      const tj = Number(this.editMontoTarjeta()) || 0;
      const tr = Number(this.editMontoTransferencia()) || 0;
      const suma = ef + tj + tr;

      if (suma < totalFactura) {
        this.snackBar.open(
          `La suma de pagos ($${suma.toLocaleString()}) no cubre el total ($${totalFactura.toLocaleString()}).`,
          'Entendido',
          { duration: 4000 }
        );
        return;
      }

      if (ef > 0) pagosPayload.push({ medio_pago: 'Efectivo', monto: ef });
      if (tj > 0) pagosPayload.push({ medio_pago: 'Tarjeta', monto: tj });
      if (tr > 0) pagosPayload.push({ medio_pago: 'Transferencia', monto: tr });
    } else {
      pagosPayload.push({
        medio_pago: this.editMedioPago(),
        monto: totalFactura,
      });
    }

    const payload: UpdateFacturaPayload = {
      propina: nuevaPropina,
      observacion: this.editObservacion().trim().slice(0, 255) || undefined,
      pagos: pagosPayload,
    };

    this.guardandoEdicion.set(true);

    this.facturacionApi.actualizarFactura(factura.id_venta, payload).subscribe({
      next: (actualizada) => {
        this.guardandoEdicion.set(false);
        this.facturaEditando.set(null);
        this.snackBar.open(
          `¡Factura #FAC-${factura.id_venta} actualizada exitosamente!`,
          'OK',
          { duration: 3000 }
        );
        // Actualizar en la lista local
        this.facturas.update((list) =>
          list.map((f) => (f.id_venta === actualizada.id_venta ? actualizada : f))
        );
      },
      error: (err) => {
        this.guardandoEdicion.set(false);
        const msg = err.error?.message || 'Error al actualizar la factura.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  anularFactura(factura: any): void {
    if (factura.estado === 'anulada') {
      this.snackBar.open(`La factura #FAC-${factura.id_venta} ya se encuentra anulada.`, 'Entendido', {
        duration: 3000,
      });
      return;
    }

    const motivo = prompt(
      `Ingresa el motivo justificado de anulación para la factura #FAC-${factura.id_venta}:`,
      'Error en método de pago o digitación',
    );
    if (motivo === null) return;
    if (!motivo.trim()) {
      this.snackBar.open('El motivo de anulación es obligatorio para auditoría contable.', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this.facturacionApi.anularFactura(factura.id_venta, motivo.trim()).subscribe({
      next: (res) => {
        this.snackBar.open(
          res.mensaje || `Factura #FAC-${factura.id_venta} anulada exitosamente.`,
          'OK',
          { duration: 3500 }
        );
        this.cargarFacturas();
        if (this.facturaEditando()?.id_venta === factura.id_venta) {
          this.facturaEditando.set(null);
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al anular la factura.';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  eliminarFactura(factura: any): void {
    this.anularFactura(factura);
  }

  obtenerResumenMediosPago(pagos: any[]): string {
    if (!pagos || pagos.length === 0) return 'Sin pagos registrados';
    return pagos
      .map((p) => `${p.medioPago?.nombre || 'Pago'}: $${Number(p.monto).toLocaleString()}`)
      .join(' | ');
  }
}
