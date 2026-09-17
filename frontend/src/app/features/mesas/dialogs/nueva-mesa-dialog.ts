import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MesasService } from '../services/mesas.service';

@Component({
  selector: 'app-nueva-mesa-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon class="title-icon">table_restaurant</mat-icon>
        <span>Registrar Nueva Mesa</span>
      </h2>

      <mat-dialog-content class="dialog-content">
        <p class="dialog-description">
          Ingresa el número físico para agregarla al mapa operativo del salón.
        </p>

        <form [formGroup]="mesaForm">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Número de Mesa</mat-label>
            <input matInput type="number" formControlName="numero" placeholder="Ej. 9" autofocus />
            @if (mesaForm.get('numero')?.hasError('required')) {
              <mat-error>El número de mesa es obligatorio</mat-error>
            }
            @if (mesaForm.get('numero')?.hasError('min')) {
              <mat-error>El número debe ser mayor a 0</mat-error>
            }
          </mat-form-field>

          @if (errorMensaje) {
            <div class="error-banner">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMensaje }}</span>
            </div>
          }
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" class="btn-confirm" (click)="guardarMesa()">
          <mat-icon>add</mat-icon>
          <span>Agregar Mesa</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      @use 'tokens' as *;

      .dialog-container {
        padding: 8px;
        min-width: 320px;
      }

      .dialog-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: $text-primary;

        .title-icon {
          color: $brand-orange;
        }
      }

      .dialog-description {
        color: $text-muted;
        font-size: 0.875rem;
        margin-bottom: 20px;
      }

      .w-full {
        width: 100%;
      }

      .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: $color-danger-bg;
        color: $color-danger;
        padding: 10px 12px;
        border-radius: $radius-md;
        font-size: 0.85rem;
        margin-top: 8px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .btn-confirm {
        background-color: $brand-orange !important;
        color: #ffffff !important;
        border-radius: $radius-md;
      }
    `,
  ],
})
export class NuevaMesaDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<NuevaMesaDialogComponent>);
  private mesasService = inject(MesasService);

  mesaForm: FormGroup = this.fb.group({
    numero: [null, [Validators.required, Validators.min(1)]],
  });

  errorMensaje: string = '';

  guardarMesa(): void {
    if (this.mesaForm.invalid) {
      this.mesaForm.markAllAsTouched();
      return;
    }

    const numero = Number(this.mesaForm.value.numero);
    const resultado = this.mesasService.crearMesa(numero);

    if (!resultado.exito) {
      this.errorMensaje = resultado.mensaje;
      return;
    }

    this.dialogRef.close(true);
  }
}
