import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { EstadoUsuario, RolUsuario, Usuario } from '../../../core/models/usuario.model';
import {
  CreateUsuarioPayload,
  UpdateUsuarioPayload,
  UsuariosApiService,
} from '../../../core/services/api/usuarios-api.service';

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

  // Estados para envío y reenvío por correo efímero (sin persistencia en BD)
  correoEnviadoExitoso = signal<string | null>(null);
  enviandoCorreoManual = signal<boolean>(false);
  mensajeEnvioManual = signal<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  correoReenvioControl = new FormControl('', [Validators.required, Validators.email]);

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
      // Correo efímero para envío del código (no se almacena en base de datos)
      correoEnvioCodigo: ['', [Validators.email]],
      // Solo relevante si es edición de un usuario existente
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

  /**
   * Despacha el código de invitación a un correo solicitado manualmente.
   * NOTA: Este correo no queda registrado en la base de datos.
   */
  enviarCodigoPorCorreo(): void {
    this.mensajeEnvioManual.set(null);

    if (this.correoReenvioControl.invalid) {
      this.correoReenvioControl.markAsTouched();
      return;
    }

    const destino = this.correoReenvioControl.value?.trim().toLowerCase();
    const usuario = this.usuarioRecienCreado();

    if (!destino || !usuario) return;

    this.enviandoCorreoManual.set(true);
    this.usuariosApi.enviarCodigoPorCorreo(usuario.id_usuario, destino).subscribe({
      next: (res: any) => {
        this.enviandoCorreoManual.set(false);
        if (res.success || res.transport === 'smtp' || res.transport === 'resend') {
          this.correoEnviadoExitoso.set(destino);
          this.mensajeEnvioManual.set({
            tipo: 'exito',
            texto: `¡Código despachado a ${destino}! Revisa la bandeja de entrada o la carpeta de Spam.`,
          });
        } else {
          this.mensajeEnvioManual.set({
            tipo: 'error',
            texto: res.errorSmtp || res.mensaje || 'No se pudo despachar el correo vía SMTP.',
          });
        }
        this.correoReenvioControl.reset();
      },
      error: (err) => {
        this.enviandoCorreoManual.set(false);
        const msg =
          err.error?.message ||
          (Array.isArray(err.error?.message) ? err.error.message.join('. ') : 'Error al enviar el correo.');
        this.mensajeEnvioManual.set({
          tipo: 'error',
          texto: msg,
        });
      },
    });
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
      const correoEnvio = val.correoEnvioCodigo?.trim() ? val.correoEnvioCodigo.trim().toLowerCase() : undefined;
      const baseUsuario = val.usuario?.trim() ? val.usuario.trim() : undefined;

      const payload: CreateUsuarioPayload = {
        nombre: val.nombre.trim(),
        usuario: baseUsuario,
        correoEnvioCodigo: correoEnvio, // Se envía para el despacho del correo
        // email NO se envía: en BD se guardará en null para colaboradores con código
        rol: val.rol,
        estado: val.estado ? ('activo' as EstadoUsuario) : ('inactivo' as EstadoUsuario),
      };

      this.usuariosApi.crear(payload).subscribe({
        next: (nuevoUsuario: any) => {
          this.guardando.set(false);
          if (nuevoUsuario.codigoInvitacion) {
            this.invitacionGenerada.set(nuevoUsuario.codigoInvitacion);
            this.usuarioRecienCreado.set(nuevoUsuario);
            if (nuevoUsuario.correoEnviado && nuevoUsuario.correoDestino) {
              this.correoEnviadoExitoso.set(nuevoUsuario.correoDestino);
            } else if (nuevoUsuario.correoDestino && nuevoUsuario.errorSmtp) {
              this.mensajeEnvioManual.set({
                tipo: 'error',
                texto: `Aviso del servidor de correo: ${nuevoUsuario.errorSmtp}. Puedes reintentar abajo.`,
              });
            }
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
