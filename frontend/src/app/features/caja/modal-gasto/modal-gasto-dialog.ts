import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CajaApiService } from '../../../core/services/api/caja-api.service';

@Component({
  selector: 'app-modal-gasto-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './modal-gasto-dialog.html',
  styleUrl: './modal-gasto-dialog.scss',
})
export class ModalGastoDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<ModalGastoDialogComponent>);
  private cajaApi = inject(CajaApiService);
  private snackBar = inject(MatSnackBar);

  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  tiposGasto: string[] = ['Insumos', 'Aseo', 'Servicios', 'Personal', 'Otros'];
  mediosPago: string[] = ['Efectivo', 'Transferencia'];

  gastoForm: FormGroup = this.fb.group({
    descripcion: ['', [Validators.required, Validators.minLength(3)]],
    total: [null, [Validators.required, Validators.min(1)]],
    tipo_gasto: ['Insumos', [Validators.required]],
    medio_pago: ['Efectivo', [Validators.required]],
    observacion: [''],
  });

  guardar(): void {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const formVal = this.gastoForm.value;

    this.cajaApi
      .registrarGasto({
        descripcion: formVal.descripcion.trim(),
        total: Number(formVal.total),
        tipo_gasto: formVal.tipo_gasto,
        medio_pago: formVal.medio_pago,
        observacion: formVal.observacion?.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.snackBar.open('Gasto registrado exitosamente.', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.isSaving.set(false);
          console.error('Error registrando gasto:', err);
          this.errorMessage.set(
            err.error?.message || 'Ocurrió un error al intentar registrar el gasto.'
          );
        },
      });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
