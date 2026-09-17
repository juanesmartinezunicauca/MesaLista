import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-outer-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule],
  styleUrl: './outer-header.scss',
  templateUrl: './outer-header.html',
})
export class OuterHeader {
  private authService = inject(AuthService);

  currentUser = computed(() => {
    const user = this.authService.currentUser();
    return {
      nombre: user?.nombre || 'Administrador',
      rol: user?.rol || 'administrador',
      iniciales: user?.iniciales || 'AD',
    };
  });

  onLogout(): void {
    this.authService.logout();
  }
}

