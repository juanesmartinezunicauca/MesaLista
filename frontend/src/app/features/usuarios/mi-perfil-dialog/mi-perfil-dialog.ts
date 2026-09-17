import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-mi-perfil-dialog',
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
  templateUrl: './mi-perfil-dialog.html',
  styleUrl: './mi-perfil-dialog.scss',
})
export class MiPerfilDialogComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<MiPerfilDialogComponent>);

  usuarioActual = this.authService.currentUser;

  perfilForm: FormGroup;
  guardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);
  exitoMensaje = signal<string | null>(null);
  mostrarPassword = signal<boolean>(false);
  mostrarConfirmPassword = signal<boolean>(false);

  constructor() {
    const user = this.usuarioActual();
    this.perfilForm = this.fb.group({
      nombre: [user?.nombre || '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      password: ['', [Validators.minLength(6), Validators.maxLength(100)]],
      confirmPassword: [''],
    });
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  toggleMostrarConfirmPassword(): void {
    this.mostrarConfirmPassword.update((v) => !v);
  }

  tieneError(campo: string, error: string): boolean {
    const control = this.perfilForm.get(campo);
    return !!(control?.hasError(error) && control?.touched);
  }

  guardar(): void {
    this.errorMensaje.set(null);
    this.exitoMensaje.set(null);

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    const { nombre, password, confirmPassword } = this.perfilForm.value;

    if (password) {
      if (password !== confirmPassword) {
        this.errorMensaje.set('Las contraseñas no coinciden.');
        return;
      }
    }

    const payload: { nombre?: string; password?: string } = {};
    if (nombre && nombre.trim() !== this.usuarioActual()?.nombre) {
      payload.nombre = nombre.trim();
    }
    if (password && password.trim()) {
      payload.password = password.trim();
    }

    if (Object.keys(payload).length === 0) {
      this.dialogRef.close();
      return;
    }

    this.guardando.set(true);

    this.authService.actualizarPerfil(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exitoMensaje.set('Perfil actualizado exitosamente.');
        setTimeout(() => {
          this.dialogRef.close(true);
        }, 800);
      },
      error: (err) => {
        this.guardando.set(false);
        const msg =
          err.error?.message ||
          (Array.isArray(err.error?.message) ? err.error.message.join('. ') : 'Error al actualizar el perfil.');
        this.errorMensaje.set(msg);
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
