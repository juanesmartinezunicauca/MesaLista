import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { clienteCarritoGuard } from './cliente-carrito.guard';
import { AuthService } from '../services/auth/auth.service';
import { UsuarioSesion } from '../models/usuario.model';
import { signal } from '@angular/core';

describe('clienteCarritoGuard', () => {
  let mockCurrentUserSignal = signal<UsuarioSesion | null>(null);
  let mockRouter: {
    createUrlTree: (commands: any[], extras?: any) => UrlTree;
  };

  const executeGuard = () => {
    return TestBed.runInInjectionContext(() =>
      clienteCarritoGuard({} as any, {} as any)
    );
  };

  beforeEach(() => {
    mockCurrentUserSignal.set(null);
    mockRouter = {
      createUrlTree: (commands: any[], extras?: any) => {
        return {
          toString: () => commands.join('/'),
          commands,
          extras,
        } as unknown as UrlTree;
      },
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: mockCurrentUserSignal,
          },
        },
        {
          provide: Router,
          useValue: mockRouter,
        },
      ],
    });
  });

  it('debe redirigir a /cliente?auth=required si no hay sesión activa', () => {
    mockCurrentUserSignal.set(null);
    const result = executeGuard() as any;
    expect(result).toBeTruthy();
    expect(result.commands).toEqual(['/cliente']);
    expect(result.extras?.queryParams).toEqual({ auth: 'required' });
  });

  it('debe permitir acceso al carrito si el usuario autenticado tiene rol cliente', () => {
    mockCurrentUserSignal.set({
      id_usuario: 1,
      nombre: 'Juan Perez',
      usuario: 'juan@gmail.com',
      email: 'juan@gmail.com',
      rol: 'cliente',
      token: 'jwt-token-sample',
      iniciales: 'JP',
    });

    const result = executeGuard();
    expect(result).toBe(true);
  });

  it('debe redirigir a /mesas si el usuario autenticado es parte del staff (no es cliente)', () => {
    mockCurrentUserSignal.set({
      id_usuario: 2,
      nombre: 'Carlos Cajero',
      usuario: 'cajero',
      rol: 'cajero',
      token: 'jwt-token-sample',
      iniciales: 'CC',
    });

    const result = executeGuard() as any;
    expect(result).toBeTruthy();
    expect(result.commands).toEqual(['/mesas']);
  });
});
