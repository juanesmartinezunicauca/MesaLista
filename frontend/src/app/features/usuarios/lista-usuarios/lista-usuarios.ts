import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EstadoUsuario, RolUsuario, Usuario } from '../../../core/models/usuario.model';
import { UsuariosApiService } from '../../../core/services/api/usuarios-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioDialogComponent } from '../usuario-dialog/usuario-dialog';

interface MetricasUsuarios {
  total: number;
  activos: number;
  inactivos: number;
  administradores: number;
  meseros: number;
  cajeros: number;
  cocina: number;
}

@Component({
  selector: 'app-lista-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './lista-usuarios.html',
  styleUrl: './lista-usuarios.scss',
})
export class ListaUsuariosComponent implements OnInit {
  private usuariosApi = inject(UsuariosApiService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  usuarioActual = this.authService.currentUser;

  // Estado reactivo principal
  usuarios = signal<Usuario[]>([]);
  cargando = signal<boolean>(false);
  error = signal<string | null>(null);

  // Filtros
  filtroRol = signal<string>('todos');
  filtroEstado = signal<string>('todos');
  busqueda = signal<string>('');

  // Métricas computadas
  metricas = computed<MetricasUsuarios>(() => {
    const list = this.usuarios();
    return {
      total: list.length,
      activos: list.filter((u) => u.estado === 'activo').length,
      inactivos: list.filter((u) => u.estado === 'inactivo').length,
      administradores: list.filter((u) => u.rol === 'administrador').length,
      meseros: list.filter((u) => u.rol === 'mesero').length,
      cajeros: list.filter((u) => u.rol === 'cajero').length,
      cocina: list.filter((u) => u.rol === 'cocina').length,
    };
  });

  // Lista filtrada reactivamente
  usuariosFiltrados = computed<Usuario[]>(() => {
    const list = this.usuarios();
    const rol = this.filtroRol();
    const estado = this.filtroEstado();
    const search = this.busqueda().trim().toLowerCase();

    return list.filter((u) => {
      const coincideRol = rol === 'todos' || u.rol === rol;
      const coincideEstado = estado === 'todos' || u.estado === estado;
      const coincideBusqueda =
        !search ||
        u.nombre.toLowerCase().includes(search) ||
        u.usuario.toLowerCase().includes(search);

      return coincideRol && coincideEstado && coincideBusqueda;
    });
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.usuariosApi.obtenerTodos().subscribe({
      next: (data) => {
        this.usuarios.set(data || []);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar la lista de personal. Verifica la conexión con el servidor.');
        console.error('Error al cargar usuarios:', err);
      },
    });
  }

  abrirDialogoCrear(): void {
    const ref = this.dialog.open(UsuarioDialogComponent, {
      width: '480px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.accion === 'creado' && res.usuario) {
        this.usuarios.update((prev) => [...prev, res.usuario]);
        this.mostrarMensaje(`Usuario "${res.usuario.nombre}" registrado exitosamente.`);
      }
    });
  }

  abrirDialogoEditar(usuario: Usuario): void {
    const ref = this.dialog.open(UsuarioDialogComponent, {
      width: '480px',
      disableClose: true,
      data: { usuario },
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.accion === 'guardado' && res.usuario) {
        this.usuarios.update((prev) =>
          prev.map((u) => (u.id_usuario === res.usuario.id_usuario ? res.usuario : u))
        );
        this.mostrarMensaje(`Usuario "${res.usuario.nombre}" actualizado.`);
      }
    });
  }

  toggleEstado(usuario: Usuario): void {
    const nuevoEstado: EstadoUsuario = usuario.estado === 'activo' ? 'inactivo' : 'activo';

    // Evitar que el administrador actual se auto-inactive
    if (usuario.id_usuario === this.usuarioActual()?.id_usuario && nuevoEstado === 'inactivo') {
      this.mostrarMensaje('No puedes desactivar tu propia cuenta de sesión.', true);
      return;
    }

    this.usuariosApi.cambiarEstado(usuario.id_usuario, nuevoEstado).subscribe({
      next: (actualizado) => {
        this.usuarios.update((prev) =>
          prev.map((u) => (u.id_usuario === usuario.id_usuario ? { ...u, estado: actualizado.estado } : u))
        );
        this.mostrarMensaje(`Estado de ${usuario.nombre} cambiado a ${actualizado.estado}.`);
      },
      error: (err) => {
        this.mostrarMensaje('Error al cambiar el estado del usuario.', true);
        console.error(err);
      },
    });
  }

  eliminarUsuario(usuario: Usuario): void {
    if (usuario.id_usuario === this.usuarioActual()?.id_usuario) {
      this.mostrarMensaje('No puedes eliminar tu propia cuenta en sesión.', true);
      return;
    }

    const confirma = confirm(
      `¿Estás seguro de retirar al usuario "${usuario.nombre}" (@${usuario.usuario})?\n\nSi tiene historial de ventas o pedidos registrados, se desactivará automáticamente para proteger la contabilidad.`
    );

    if (!confirma) return;

    this.usuariosApi.eliminar(usuario.id_usuario).subscribe({
      next: (res) => {
        if (res.tipo === 'soft-delete') {
          this.usuarios.update((prev) =>
            prev.map((u) => (u.id_usuario === usuario.id_usuario ? { ...u, estado: 'inactivo' } : u))
          );
          this.mostrarMensaje(res.mensaje);
        } else {
          this.usuarios.update((prev) => prev.filter((u) => u.id_usuario !== usuario.id_usuario));
          this.mostrarMensaje(res.mensaje);
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al eliminar el usuario.';
        this.mostrarMensaje(msg, true);
        console.error(err);
      },
    });
  }

  onBusquedaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda.set(input?.value || '');
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroRol.set('todos');
    this.filtroEstado.set('todos');
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'US';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  private mostrarMensaje(mensaje: string, esError = false): void {
    this.snackBar.open(mensaje, 'Entendido', {
      duration: 3500,
      panelClass: esError ? ['snackbar-error'] : ['snackbar-success'],
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }
}
