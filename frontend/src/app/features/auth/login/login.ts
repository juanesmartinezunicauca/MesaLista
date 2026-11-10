import { Component, inject, signal, OnInit, AfterViewInit, NgZone } from '@angular/core';
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
export class LoginComponent implements OnInit, AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  googleInitialized = signal<boolean>(false);

  // 'acceso' = ingreso habitual de personal y clientes
  // 'registro' = activación de cuenta para nuevo colaborador
  modo = signal<'acceso' | 'registro'>('acceso');
  codigoInvitacion = signal<string>('');

  ngOnInit(): void {
    // Si viene desde un enlace de invitación con ?codigo=INV-XXXXXX
    this.route.queryParams.subscribe((params) => {
      if (params['codigo']) {
        const cod = String(params['codigo']).trim().toUpperCase();
        this.codigoInvitacion.set(cod);
        this.modo.set('registro');
      } else if (params['tab'] === 'nuevo-empleado' || params['modo'] === 'registro') {
        this.modo.set('registro');
      }
    });
  }

  setModo(modo: 'acceso' | 'registro'): void {
    this.modo.set(modo);
    this.errorMessage.set(null);
  }

  onCodigoInvitacionInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.toUpperCase().replace(/\s+/g, '');
    // Si el usuario escribe solo los dígitos (ej. 482910), formatear amigablemente como INV-482910
    if (/^\d{4,6}$/.test(val)) {
      val = `INV-${val}`;
    }
    this.codigoInvitacion.set(val);
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
    // Si está en modo registro de colaborador y no ha escrito el código, advertirle antes de abrir Google
    if (this.modo() === 'registro' && !this.codigoInvitacion().trim()) {
      this.errorMessage.set('Por favor ingresa tu código de invitación (ej. INV-821943) para activar tu perfil de colaborador.');
      return;
    }

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

    // Validación preventiva en modo registro
    if (this.modo() === 'registro' && !this.codigoInvitacion().trim()) {
      this.errorMessage.set('Por favor ingresa tu código de invitación (ej. INV-821943) antes de continuar con Google.');
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
            err.error?.message || 'Acceso no autorizado con tu cuenta de Google. Verifica tu código de invitación o correo.'
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
