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
import { CreateUsuarioPayload, UpdateUsuarioPayload, UsuariosApiService } from '../../../core/services/api/usuarios-api.service';

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
  invitacionGenerada = signal<string | null>(null);
  usuarioRecienCreado = signal<Usuario | null>(null);
  copiado = signal<boolean>(false);

  constructor() {
    const u = this.data?.usuario;

    this.usuarioForm = this.fb.group({
      nombre: [u?.nombre || '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      usuario: [
        u?.usuario || '',
        [
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^[a-zA-Z0-9._-]+$/),
        ],
      ],
      email: [u?.email || '', [Validators.email]],
      rol: [u?.rol || 'mesero', [Validators.required]],
      estado: [u?.estado ? u.estado === 'activo' : true],
    });
  }

  tieneError(campo: string, error: string): boolean {
    const control = this.usuarioForm.get(campo);
    return !!(control?.hasError(error) && control?.touched);
  }

  getRolSeleccionado(): { valor: RolUsuario; label: string; icon: string; desc: string } | undefined {
    const rolActual = this.usuarioForm?.get('rol')?.value;
    return this.rolesDisponibles.find((r) => r.valor === rolActual);
  }

  copiarCodigo(): void {
    const cod = this.invitacionGenerada();
    if (cod && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cod).then(() => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 2500);
      });
    }
  }

  cerrarConExito(): void {
    this.dialogRef.close({ accion: 'creado', usuario: this.usuarioRecienCreado() });
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
      const payload: UpdateUsuarioPayload = {
        nombre: val.nombre.trim(),
        email: val.email?.trim() ? val.email.trim().toLowerCase() : undefined,
        rol: val.rol,
        estado: val.estado ? 'activo' : 'inactivo',
      };

      if (val.usuario && val.usuario.trim()) {
        payload.usuario = val.usuario.trim();
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
      const email = val.email?.trim() ? val.email.trim().toLowerCase() : undefined;
      const baseUsuario = val.usuario?.trim() || (email ? email.split('@')[0] : val.nombre.trim().toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30));
      const payload: CreateUsuarioPayload = {
        nombre: val.nombre.trim(),
        email: email,
        usuario: baseUsuario,
        rol: val.rol,
        estado: val.estado ? ('activo' as EstadoUsuario) : ('inactivo' as EstadoUsuario),
      };

      this.usuariosApi.crear(payload).subscribe({
        next: (nuevoUsuario) => {
          this.guardando.set(false);
          if (nuevoUsuario.codigoInvitacion) {
            this.invitacionGenerada.set(nuevoUsuario.codigoInvitacion);
            this.usuarioRecienCreado.set(nuevoUsuario);
          } else {
            this.dialogRef.close({ accion: 'creado', usuario: nuevoUsuario });
          }
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
