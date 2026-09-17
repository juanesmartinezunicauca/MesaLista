import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../../core/services/auth/auth.service';
import { MiPerfilDialogComponent } from '../../../features/usuarios/mi-perfil-dialog/mi-perfil-dialog';

@Component({
  selector: 'app-outer-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
  ],
  styleUrl: './outer-header.scss',
  templateUrl: './outer-header.html',
})
export class OuterHeader {
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  currentUser = computed(() => {
    const user = this.authService.currentUser();
    return {
      nombre: user?.nombre || 'Administrador',
      rol: user?.rol || 'administrador',
      iniciales: user?.iniciales || 'AD',
    };
  });

  abrirMiPerfil(): void {
    this.dialog.open(MiPerfilDialogComponent, {
      width: '460px',
    });
  }

  onLogout(): void {
    this.authService.logout();
  }
}

