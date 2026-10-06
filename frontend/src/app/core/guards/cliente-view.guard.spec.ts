import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { clienteViewGuard } from './cliente-view.guard';
import { AuthService } from '../services/auth/auth.service';
import { UsuarioSesion } from '../models/usuario.model';
import { signal } from '@angular/core';

describe('clienteViewGuard', () => {
  let mockCurrentUserSignal = signal<UsuarioSesion | null>(null);
  let mockRouter: {
    createUrlTree: (commands: any[]) => UrlTree;
  };

  const executeGuard = () => {
    return TestBed.runInInjectionContext(() =>
      clienteViewGuard({} as any, {} as any)
    );
  };

  beforeEach(() => {
    mockCurrentUserSignal.set(null);
    mockRouter = {
      createUrlTree: (commands: any[]) => {
        return {
          toString: () => commands.join('/'),
          commands,
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

  it('debe permitir acceso si no hay usuario autenticado (modo público/visitante)', () => {
    mockCurrentUserSignal.set(null);
    const result = executeGuard();
    expect(result).toBe(true);
  });

  it('debe permitir acceso si el usuario autenticado tiene rol cliente', () => {
    mockCurrentUserSignal.set({
      id_usuario: 1,
      nombre: 'Estudiante Prueba',
      usuario: 'estudiante@unicauca.edu.co',
      rol: 'cliente',
      token: 'jwt-token',
      iniciales: 'EP',
    });

    const result = executeGuard();
    expect(result).toBe(true);
  });

  it('debe redirigir a /mesas si el usuario autenticado es administrador', () => {
    mockCurrentUserSignal.set({
      id_usuario: 2,
      nombre: 'Admin General',
      usuario: 'admin',
      rol: 'administrador',
      token: 'jwt-token',
      iniciales: 'AG',
    });

    const result = executeGuard() as UrlTree;
    expect(result).toBeTruthy();
    expect((result as any).commands).toEqual(['/mesas']);
  });

  it('debe redirigir a /mesas si el usuario autenticado es mesero, cajero o cocina', () => {
    const rolesStaff = ['mesero', 'cajero', 'cocina'] as const;

    rolesStaff.forEach((rol) => {
      mockCurrentUserSignal.set({
        id_usuario: 3,
        nombre: 'Personal Staff',
        usuario: 'staff',
        rol,
        token: 'jwt-token',
        iniciales: 'PS',
      });

      const result = executeGuard() as UrlTree;
      expect((result as any).commands).toEqual(['/mesas']);
    });
  });
});
