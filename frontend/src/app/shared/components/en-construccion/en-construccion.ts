import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-en-construccion',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="coming-soon-container">
      <div class="card-glow"></div>
      <div class="content">
        <div class="icon-wrapper">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
        <h1>{{ moduloNombre }}</h1>
        <div class="badge">Próximamente</div>
        <p class="description">
          Este módulo se encuentra en fase de desarrollo e integración para Luigie's POS.
          Estará disponible en una próxima actualización.
        </p>
        <button mat-flat-button color="primary" routerLink="/mesas">
          <mat-icon>table_restaurant</mat-icon>
          Volver a Mesas
        </button>
      </div>
    </div>
  `,
  styles: [`
    .coming-soon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 120px);
      padding: 24px;
      position: relative;
      overflow: hidden;
    }

    .card-glow {
      position: absolute;
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, rgba(0, 0, 0, 0) 70%);
      filter: blur(40px);
      z-index: 0;
    }

    .content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 480px;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px 32px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }

    .icon-wrapper {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
      }
    }

    h1 {
      margin: 0 0 8px;
      font-size: 1.6rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .description {
      color: #94a3b8;
      font-size: 0.92rem;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    button {
      border-radius: 10px;
      padding: 0 20px;
      height: 44px;
      font-weight: 600;
    }
  `]
})
export class EnConstruccionComponent {
  private router = inject(Router);

  get moduloNombre(): string {
    const url = this.router.url;
    if (url.includes('domicilio')) return 'Módulo de Domicilios';
    if (url.includes('reporte')) return 'Módulo de Reportes y Analítica';
    return 'Módulo en Construcción';
  }

  get icon(): string {
    const url = this.router.url;
    if (url.includes('domicilio')) return 'delivery_dining';
    if (url.includes('reporte')) return 'bar_chart';
    return 'construction';
  }
}
