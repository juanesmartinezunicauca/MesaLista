import { Injectable, inject, signal } from '@angular/core';
import { DomiciliosApiService } from '../api/domicilios-api.service';
import { AuthService } from '../auth/auth.service';
import { Domicilio } from '../../models';

const ROLES_DOMICILIOS: ReadonlySet<string> = new Set([
  'administrador',
  'cajero',
  'mesero',
]);

/**
 * Servicio centralizado de notificaciones operativas para solicitudes de domicilios.
 * Mantiene sincronizado el contador de pedidos en estado 'Pendiente' (Por Aceptar)
 * para mostrar la insignia numérica en el menú lateral en tiempo real.
 */
@Injectable({
  providedIn: 'root',
})
export class DomiciliosNotificacionService {
  private readonly domiciliosApi = inject(DomiciliosApiService, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });

  readonly pendientesCount = signal<number>(0);

  private readonly pollingIntervalMs = 10_000;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private monitoreando = false;
  private consultaEnCurso = false;

  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.refrescar();
    }
  };

  puedeMonitorear(): boolean {
    const rol = this.authService?.currentUser()?.rol;
    return !!rol && ROLES_DOMICILIOS.has(rol);
  }

  iniciarMonitoreo(): void {
    if (!this.puedeMonitorear()) {
      this.pendientesCount.set(0);
      this.detenerMonitoreo();
      return;
    }

    if (this.monitoreando) {
      return;
    }

    this.monitoreando = true;
    this.refrescar();

    this.pollingTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      this.refrescar();
    }, this.pollingIntervalMs);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  detenerMonitoreo(): void {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    this.monitoreando = false;
    this.consultaEnCurso = false;

    if (!this.puedeMonitorear()) {
      this.pendientesCount.set(0);
    }
  }

  refrescar(): void {
    if (!this.puedeMonitorear()) {
      this.pendientesCount.set(0);
      return;
    }

    if (!this.domiciliosApi || this.consultaEnCurso) {
      return;
    }

    this.consultaEnCurso = true;
    this.domiciliosApi.obtenerTodos({ estado: 'Pendiente' }).subscribe({
      next: (lista) => {
        this.consultaEnCurso = false;
        const pendientes = (lista || []).filter(
          (p) => !p.etapaOperativa || p.etapaOperativa === 'Pendiente',
        ).length;
        this.pendientesCount.set(pendientes);
      },
      error: () => {
        this.consultaEnCurso = false;
      },
    });
  }

  sincronizarDesdeLista(pedidos: ReadonlyArray<Pick<Domicilio, 'etapaOperativa'>>): void {
    const pendientes = (pedidos || []).filter(
      (p) => p.etapaOperativa === 'Pendiente',
    ).length;
    this.pendientesCount.set(pendientes);
  }
}
