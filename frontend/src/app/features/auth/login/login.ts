import { Component, inject, signal, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  googleInitialized = signal<boolean>(false);
  mostrarCajaInvitacion = signal<boolean>(false);
  codigoInvitacion = signal<string>('');

  onCodigoInvitacionInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.codigoInvitacion.set(input.value.toUpperCase());
  }

  ngAfterViewInit(): void {
    this.initGoogleAuth();
  }

  private initGoogleAuth(): void {
    if (typeof window === 'undefined') return;

    let attempts = 0;
    const maxAttempts = 20;

    const checkGoogle = () => {
      const google = (window as any).google;
      const clientId = environment.googleClientId;

      if (!clientId || clientId.includes('TU_GOOGLE_CLIENT_ID')) {
        console.warn('Google Client ID aún no ha sido configurado con un ID real de Google Cloud Console.');
        return;
      }

      if (google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (res: any) => {
              this.ngZone.run(() => this.handleGoogleResponse(res));
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          const btnEl = document.getElementById('google-btn-container');
          if (btnEl) {
            google.accounts.id.renderButton(btnEl, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320,
            });
            this.googleInitialized.set(true);
          }
        } catch (e) {
          console.warn('Google Identity Services aún no inicializado:', e);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkGoogle, 300);
      }
    };

    checkGoogle();
  }

  triggerGooglePrompt(): void {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this.errorMessage.set(
            'Para acceder con Google en producción, asegúrate de configurar tu GOOGLE_CLIENT_ID en environment.ts'
          );
        }
      });
    } else {
      this.errorMessage.set(
        'El componente de Google Sign-In aún se está cargando. Por favor intenta en un momento.'
      );
    }
  }

  private handleGoogleResponse(response: any): void {
    if (!response || !response.credential) {
      this.errorMessage.set('No se recibieron credenciales válidas de Google.');
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);

    const codigo = this.codigoInvitacion().trim() || undefined;
    this.authService.loginGoogle(response.credential, codigo).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.redirigirSegunRol();
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.errorMessage.set(
            err.error?.message || 'Acceso no autorizado con tu cuenta de Google.'
          );
        } else if (err.status === 0) {
          this.errorMessage.set(
            'No fue posible conectar con el servidor backend. Verifica tu conexión de red o que el servidor esté activo.'
          );
        } else {
          this.errorMessage.set(
            err.error?.message || 'Ocurrió un error al autenticar con Google. Intenta nuevamente.'
          );
        }
      },
    });
  }

  /**
   * Enruta al usuario según su rol:
   * - 'cliente': va a la vista de cliente /cliente.
   * - Roles del personal ('administrador', 'cajero', 'mesero', 'cocina'): NUNCA van a la vista de cliente;
   *   son dirigidos directamente a /mesas (o a su returnUrl operativa).
   */
  private redirigirSegunRol(): void {
    const rol = this.authService.currentUser()?.rol;
    let returnUrl = this.route.snapshot.queryParams['returnUrl'];

    if (rol === 'cliente') {
      this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/cliente') ? returnUrl : '/cliente');
    } else if (rol === 'cocina') {
      this.router.navigateByUrl(returnUrl && !returnUrl.startsWith('/cliente') ? returnUrl : '/cocina');
    } else {
      if (!returnUrl || returnUrl === '/cliente' || returnUrl === '/') {
        returnUrl = '/mesas';
      }
      this.router.navigateByUrl(returnUrl);
    }
  }
}
