import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth/auth.service';
import { RolUsuario, UsuarioSesion } from '../models/usuario.model';
import { signal } from '@angular/core';

describe('roleGuard', () => {
  let mockCurrentUserSignal = signal<UsuarioSesion | null>(null);
  let mockRouter: {
    createUrlTree: (commands: any[], navigationExtras?: any) => UrlTree;
  };

  const executeGuard = (rolesRequeridos?: RolUsuario[], url: string = '/test') => {
    const route = {
      data: rolesRequeridos ? { roles: rolesRequeridos } : {},
    } as unknown as ActivatedRouteSnapshot;

    const state = {
      url,
    } as unknown as RouterStateSnapshot;

    return TestBed.runInInjectionContext(() => roleGuard(route, state));
  };

  beforeEach(() => {
    mockCurrentUserSignal.set(null);
    mockRouter = {
      createUrlTree: (commands: any[], navigationExtras?: any) => {
        return {
          toString: () => commands.join('/'),
          commands,
          navigationExtras,
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

  it('debe redirigir al login si no hay usuario autenticado en sesión', () => {
    mockCurrentUserSignal.set(null);
    const result = executeGuard(['administrador'], '/usuarios') as UrlTree;

    expect(result).toBeTruthy();
    expect((result as any).commands).toEqual(['/login']);
    expect((result as any).navigationExtras?.queryParams?.returnUrl).toBe('/usuarios');
  });

  it('debe permitir el acceso si no se configuraron roles específicos en la ruta', () => {
    mockCurrentUserSignal.set({
      id_usuario: 1,
      nombre: 'Carlos Mesero',
      usuario: 'cmesero',
      rol: 'mesero',
    });

    const result = executeGuard();
    expect(result).toBe(true);
  });

  it('debe permitir el acceso si el rol del usuario está incluido en los roles permitidos', () => {
    mockCurrentUserSignal.set({
      id_usuario: 1,
      nombre: 'Administrador General',
      usuario: 'admin',
      rol: 'administrador',
    });

    const result = executeGuard(['administrador']);
    expect(result).toBe(true);
  });

  it('debe permitir a un mesero acceder a la ruta de mesas', () => {
    mockCurrentUserSignal.set({
      id_usuario: 2,
      nombre: 'Juan Mesero',
      usuario: 'jmesero',
      rol: 'mesero',
    });

    const result = executeGuard(['administrador', 'cajero', 'mesero'], '/mesas');
    expect(result).toBe(true);
  });

  it('debe bloquear a un mesero cuando intenta acceder a /usuarios y redirigir a /mesas', () => {
    mockCurrentUserSignal.set({
      id_usuario: 2,
      nombre: 'Juan Mesero',
      usuario: 'jmesero',
      rol: 'mesero',
    });

    const result = executeGuard(['administrador'], '/usuarios') as UrlTree;
    expect(result).toBeTruthy();
    expect((result as any).commands).toEqual(['/mesas']);
  });

  it('debe bloquear a un mesero cuando intenta acceder a /catalogo y redirigir a /mesas', () => {
    mockCurrentUserSignal.set({
      id_usuario: 2,
      nombre: 'Juan Mesero',
      usuario: 'jmesero',
      rol: 'mesero',
    });

    const result = executeGuard(['administrador', 'cajero'], '/catalogo') as UrlTree;
    expect(result).toBeTruthy();
    expect((result as any).commands).toEqual(['/mesas']);
  });

  it('debe permitir a un cajero acceder al catálogo de consulta', () => {
    mockCurrentUserSignal.set({
      id_usuario: 3,
      nombre: 'Ana Cajera',
      usuario: 'acajera',
      rol: 'cajero',
    });

    const result = executeGuard(['administrador', 'cajero'], '/catalogo');
    expect(result).toBe(true);
  });
});
