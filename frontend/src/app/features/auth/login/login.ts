import { Component, inject, signal, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

// Angular Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);

  loginForm: FormGroup = this.fb.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    rememberMe: [false],
  });

  hidePassword = signal<boolean>(true);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  googleInitialized = signal<boolean>(false);

  ngAfterViewInit(): void {
    this.initGoogleAuth();
  }

  private initGoogleAuth(): void {
    if (typeof window === 'undefined') return;

    let attempts = 0;
    const maxAttempts = 20;

    const checkGoogle = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
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

    this.authService.loginGoogle(response.credential).subscribe({
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

  togglePasswordVisibility(event: MouseEvent): void {
    event.preventDefault();
    this.hidePassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);

    const { usuario, password } = this.loginForm.value;

    this.authService.login({ usuario, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.redirigirSegunRol();
      },

      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.errorMessage.set('Credenciales inválidas. Por favor verifica tu usuario y contraseña.');
        } else if (err.status === 0) {
          this.errorMessage.set('No fue posible conectar con el servidor backend. Verifica que el servidor esté activo.');
        } else {
          this.errorMessage.set(
            err.error?.message || 'Ocurrió un error al autenticar con el servidor. Intenta nuevamente.'
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
    } else {
      if (!returnUrl || returnUrl === '/cliente' || returnUrl === '/') {
        returnUrl = '/mesas';
      }
      this.router.navigateByUrl(returnUrl);
    }
  }
}


