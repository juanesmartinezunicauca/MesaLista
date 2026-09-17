import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { EstadoUsuario, RolUsuario, Usuario } from '../../../core/models/usuario.model';
import { UsuariosApiService } from '../../../core/services/api/usuarios-api.service';

export interface UsuarioDialogData {
  usuario?: Usuario;
}

@Component({
  selector: 'app-usuario-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  templateUrl: './usuario-dialog.html',
  styleUrl: './usuario-dialog.scss',
})
export class UsuarioDialogComponent {
  data = inject<UsuarioDialogData>(MAT_DIALOG_DATA, { optional: true });
  private fb = inject(FormBuilder);
  private usuariosApi = inject(UsuariosApiService);
  private dialogRef = inject(MatDialogRef<UsuarioDialogComponent>);

  esEdicion = signal<boolean>(!!this.data?.usuario);
  guardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);
  mostrarPassword = signal<boolean>(false);

  rolesDisponibles: { valor: RolUsuario; label: string; icon: string; desc: string }[] = [
    {
      valor: 'administrador',
      label: 'Administrador',
      icon: 'admin_panel_settings',
      desc: 'Acceso total a configuración, catálogo, reportes y usuarios',
    },
    {
      valor: 'cajero',
      label: 'Cajero',
      icon: 'point_of_sale',
      desc: 'Apertura/cierre de caja, facturación y cobro de cuentas',
    },
    {
      valor: 'mesero',
      label: 'Mesero',
      icon: 'restaurant',
      desc: 'Atención de mesas, toma de pedidos y traslado de cuentas',
    },
    {
      valor: 'cocina',
      label: 'Cocina',
      icon: 'soup_kitchen',
      desc: 'Visualización y despacho de comandas en preparación',
    },
  ];

  usuarioForm: FormGroup;

  constructor() {
    const u = this.data?.usuario;
    const isEdit = !!u;

    this.usuarioForm = this.fb.group({
      nombre: [u?.nombre || '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      usuario: [
        u?.usuario || '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^[a-zA-Z0-9._-]+$/),
        ],
      ],
      password: [
        '',
        isEdit ? [Validators.minLength(6), Validators.maxLength(100)] : [Validators.required, Validators.minLength(6), Validators.maxLength(100)],
      ],
      rol: [u?.rol || 'mesero', [Validators.required]],
      estado: [u?.estado ? u.estado === 'activo' : true],
    });
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  tieneError(campo: string, error: string): boolean {
    const control = this.usuarioForm.get(campo);
    return !!(control?.hasError(error) && control?.touched);
  }

  guardar(): void {
    this.errorMensaje.set(null);

    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }

    const val = this.usuarioForm.value;
    this.guardando.set(true);

    if (this.esEdicion() && this.data?.usuario) {
      const payload: {
        nombre?: string;
        usuario?: string;
        password?: string;
        rol?: RolUsuario;
        estado?: EstadoUsuario;
      } = {
        nombre: val.nombre.trim(),
        usuario: val.usuario.trim(),
        rol: val.rol,
        estado: val.estado ? 'activo' : 'inactivo',
      };

      if (val.password && val.password.trim()) {
        payload.password = val.password.trim();
      }

      this.usuariosApi.actualizar(this.data.usuario.id_usuario, payload).subscribe({
        next: (usuarioActualizado) => {
          this.guardando.set(false);
          this.dialogRef.close({ accion: 'guardado', usuario: usuarioActualizado });
        },
        error: (err) => {
          this.guardando.set(false);
          const msg =
            err.error?.message ||
            (Array.isArray(err.error?.message) ? err.error.message.join('. ') : 'Error al actualizar usuario.');
          this.errorMensaje.set(msg);
        },
      });
    } else {
      const payload = {
        nombre: val.nombre.trim(),
        usuario: val.usuario.trim(),
        password: val.password.trim(),
        rol: val.rol,
        estado: val.estado ? ('activo' as EstadoUsuario) : ('inactivo' as EstadoUsuario),
      };

      this.usuariosApi.crear(payload).subscribe({
        next: (nuevoUsuario) => {
          this.guardando.set(false);
          this.dialogRef.close({ accion: 'creado', usuario: nuevoUsuario });
        },
        error: (err) => {
          this.guardando.set(false);
          const msg =
            err.error?.message ||
            (Array.isArray(err.error?.message) ? err.error.message.join('. ') : 'Error al crear usuario.');
          this.errorMensaje.set(msg);
        },
      });
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
