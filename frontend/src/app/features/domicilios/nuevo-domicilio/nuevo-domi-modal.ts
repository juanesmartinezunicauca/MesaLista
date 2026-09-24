import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';

export interface ItemPedido {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

@Component({
  selector: 'app-new-delivery-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
  ],
  templateUrl: './nuevo-domi-modal.html',
  styleUrls: ['./nuevo-domi-modal.scss'],
})
export class NewDeliveryDialogComponent {
  deliveryForm: FormGroup;

  // Lista de ítems seleccionados que vendrán de tu otra ventana/componente
  itemsSeleccionados = signal<ItemPedido[]>([]);

  // Cálculo automático del total del pedido
  get totalPedido(): number {
    return this.itemsSeleccionados().reduce(
      (acc, item) => acc + item.cantidad * item.precioUnitario,
      0,
    );
  }

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<NewDeliveryDialogComponent>,
    private dialog: MatDialog, // Inyectado por si abres el selector como sub-diálogo
  ) {
    this.deliveryForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{7,10}$/)]],
      direccion: ['', Validators.required],
      notas: [''],
    });
  }

  // Método para abrir la ventana de selección de ítems del restaurante
  abrirSelectorDeItems() {
    /* 
      OPCIÓN A: Si tu selector de ítems es otro Dialog de Angular Material:
      const itemDialogRef = this.dialog.open(TuSelectorDeItemsComponent, { width: '800px' });
      itemDialogRef.afterClosed().subscribe(itemsElegidos => {
        if (itemsElegidos) {
          this.itemsSeleccionados.set(itemsElegidos);
        }
      });

      OPCIÓN B: Si prefieres simular la selección para pruebas rápidas:
    */
    this.itemsSeleccionados.set([
      { id: '1', nombre: 'Hamburguesa Especial', cantidad: 2, precioUnitario: 22000 },
      { id: '2', nombre: 'Gaseosa 1.5L', cantidad: 1, precioUnitario: 6500 },
    ]);
  }

  eliminarItem(id: string) {
    this.itemsSeleccionados.update((items) => items.filter((i) => i.id !== id));
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    if (this.deliveryForm.invalid || this.itemsSeleccionados().length === 0) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    const nuevoPedido = {
      ...this.deliveryForm.value,
      items: this.itemsSeleccionados(),
      total: this.totalPedido,
    };

    this.dialogRef.close(nuevoPedido);
  }
}
