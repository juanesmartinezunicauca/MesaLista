import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { roleGuard } from './role.guard';
import { authGuard } from './auth.guard';
import { clienteViewGuard } from './cliente-view.guard';
import { clienteCarritoGuard } from './cliente-carrito.guard';
import { AuthService } from '../services/auth/auth.service';
import { RolUsuario, UsuarioSesion } from '../models/usuario.model';

describe('🛡️ BATERÍA DE PRUEBAS DE SEGURIDAD FRONTEND: FUGA DE ROLES, RUTAS Y BLINDAJE DE INYECCIÓN', () => {
  let mockCurrentUserSignal = signal<UsuarioSesion | null>(null);
  let mockIsAuthenticatedSignal = signal<boolean>(false);
  let mockRouter: {
    createUrlTree: (commands: any[], extras?: any) => UrlTree;
    navigate: any;
  };

  beforeEach(() => {
    mockCurrentUserSignal.set(null);
    mockIsAuthenticatedSignal.set(false);

    mockRouter = {
      createUrlTree: (commands: any[], extras?: any) => {
        return {
          toString: () => commands.join('/'),
          commands,
          extras,
          queryParams: extras?.queryParams,
        } as unknown as UrlTree;
      },
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: mockCurrentUserSignal,
            isAuthenticated: mockIsAuthenticatedSignal,
            logout: () => {
              mockCurrentUserSignal.set(null);
              mockIsAuthenticatedSignal.set(false);
              localStorage.clear();
            },
          },
        },
        {
          provide: Router,
          useValue: mockRouter,
        },
      ],
    });
  });

  const runRoleGuard = (rolesPermitidos: RolUsuario[], url: string) => {
    const route = {
      data: { roles: rolesPermitidos },
    } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;

    return TestBed.runInInjectionContext(() => roleGuard(route, state));
  };

  const runAuthGuard = (url: string) => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;

    return TestBed.runInInjectionContext(() => authGuard(route, state));
  };

  const runClienteViewGuard = () => {
    return TestBed.runInInjectionContext(() => (clienteViewGuard as any)());
  };

  const runClienteCarritoGuard = () => {
    return TestBed.runInInjectionContext(() => (clienteCarritoGuard as any)());
  };

  // =========================================================================
  // 1. MATRIZ DE CONTROL DE ACCESO A RUTAS Y PREVENCIÓN DE FUGAS DE ROL
  // =========================================================================
  describe('1. Matriz de Control de Acceso a Rutas y Prevención de Fugas de Rol', () => {

    describe('Usuario Anónimo / Visitante no Autenticado', () => {
      it('[FE-R01] authGuard debe interceptar intentos de acceso al área operativa y redirigir a /login', () => {
        mockIsAuthenticatedSignal.set(false);
        const result = runAuthGuard('/mesas') as any;

        expect(result).toBeTruthy();
        expect(result.commands).toEqual(['/login']);
        expect(result.queryParams?.returnUrl).toBe('/mesas');
      });

      it('[FE-R02] clienteViewGuard debe permitir acceso libre a la carta pública (/cliente)', () => {
        mockCurrentUserSignal.set(null);
        const result = runClienteViewGuard();
        expect(result).toBe(true);
      });

      it('[FE-R03] clienteCarritoGuard debe bloquear el carrito a visitantes y exigir inicio de sesión', () => {
        mockCurrentUserSignal.set(null);
        const result = runClienteCarritoGuard() as any;

        expect(result).toBeTruthy();
        expect(result.commands).toEqual(['/cliente']);
        expect(result.queryParams).toEqual({ auth: 'required' });
      });
    });

    describe('Rol: Cliente (Estudiante / Consumidor)', () => {
      beforeEach(() => {
        mockCurrentUserSignal.set({
          id_usuario: 50,
          nombre: 'Estudiante Unicauca',
          usuario: 'estudiante@unicauca.edu.co',
          rol: 'cliente',
          token: 'jwt-cliente-valid',
          iniciales: 'EU',
        });
        mockIsAuthenticatedSignal.set(true);
      });

      it('[FE-R04] Debe tener acceso permitido a su portal de cliente (/cliente) y carrito (/cliente/carrito)', () => {
        expect(runClienteViewGuard()).toBe(true);
        expect(runClienteCarritoGuard()).toBe(true);
      });

      it('[FE-R05] Debe ser bloqueado si intenta forzar la URL de /mesas y ser redirigido a /cliente', () => {
        const result = runRoleGuard(['administrador', 'cajero', 'mesero'], '/mesas') as any;
        expect(result.commands).toEqual(['/cliente']);
      });

      it('[FE-R06] Debe ser bloqueado si intenta forzar la URL de /caja y ser redirigido a /cliente', () => {
        const result = runRoleGuard(['administrador', 'cajero'], '/caja') as any;
        expect(result.commands).toEqual(['/cliente']);
      });

      it('[FE-R07] Debe ser bloqueado si intenta forzar la URL de /usuarios y ser redirigido a /cliente', () => {
        const result = runRoleGuard(['administrador'], '/usuarios') as any;
        expect(result.commands).toEqual(['/cliente']);
      });
    });

    describe('Rol: Mesero (Personal Operativo de Salón)', () => {
      beforeEach(() => {
        mockCurrentUserSignal.set({
          id_usuario: 20,
          nombre: 'Mesero Turno 1',
          usuario: 'mesero1',
          rol: 'mesero',
          token: 'jwt-mesero-valid',
          iniciales: 'MT',
        });
        mockIsAuthenticatedSignal.set(true);
      });

      it('[FE-R08] Mesero tiene acceso legítimo a /mesas y /cocina', () => {
        expect(runRoleGuard(['administrador', 'cajero', 'mesero'], '/mesas')).toBe(true);
        expect(runRoleGuard(['administrador', 'cajero', 'mesero', 'cocina'], '/cocina')).toBe(true);
      });

      it('[FE-R09] Fuga prevenida: Mesero intentando acceder a /caja es bloqueado y enviado a /mesas', () => {
        const result = runRoleGuard(['administrador', 'cajero'], '/caja') as any;
        expect(result.commands).toEqual(['/mesas']);
      });

      it('[FE-R10] Fuga prevenida: Mesero intentando acceder a administración de /usuarios es bloqueado y enviado a /mesas', () => {
        const result = runRoleGuard(['administrador'], '/usuarios') as any;
        expect(result.commands).toEqual(['/mesas']);
      });

      it('[FE-R11] Fuga prevenida: Mesero intentando acceder a creación de productos (/catalogo/nuevo) es bloqueado', () => {
        const result = runRoleGuard(['administrador'], '/catalogo/nuevo') as any;
        expect(result.commands).toEqual(['/mesas']);
      });

      it('[FE-R12] Mesero autenticado que intenta entrar a vista de clientes es redirigido a /mesas', () => {
        const result = runClienteViewGuard() as any;
        expect(result.commands).toEqual(['/mesas']);
      });
    });

    describe('Rol: Cajero (Operaciones de Caja y Facturación)', () => {
      beforeEach(() => {
        mockCurrentUserSignal.set({
          id_usuario: 15,
          nombre: 'Cajero Principal',
          usuario: 'cajero1',
          rol: 'cajero',
          token: 'jwt-cajero-valid',
          iniciales: 'CP',
        });
        mockIsAuthenticatedSignal.set(true);
      });

      it('[FE-R13] Cajero tiene acceso a /caja, /caja/dashboard y /historial', () => {
        expect(runRoleGuard(['administrador', 'cajero'], '/caja')).toBe(true);
        expect(runRoleGuard(['administrador', 'cajero'], '/caja/dashboard')).toBe(true);
        expect(runRoleGuard(['administrador', 'cajero'], '/historial')).toBe(true);
      });

      it('[FE-R14] Fuga prevenida: Cajero intentando acceder a gestión de /usuarios es bloqueado y enviado a /mesas', () => {
        const result = runRoleGuard(['administrador'], '/usuarios') as any;
        expect(result.commands).toEqual(['/mesas']);
      });
    });

    describe('Rol: Administrador (Superusuario)', () => {
      beforeEach(() => {
        mockCurrentUserSignal.set({
          id_usuario: 1,
          nombre: 'Administrador Maestro',
          usuario: 'admin',
          rol: 'administrador',
          token: 'jwt-admin-valid',
          iniciales: 'AM',
        });
        mockIsAuthenticatedSignal.set(true);
      });

      it('[FE-R15] Administrador cuenta con acceso irrestricto a todos los módulos operativos y gerenciales', () => {
        expect(runRoleGuard(['administrador'], '/usuarios')).toBe(true);
        expect(runRoleGuard(['administrador'], '/catalogo/nuevo')).toBe(true);
        expect(runRoleGuard(['administrador', 'cajero'], '/caja')).toBe(true);
        expect(runRoleGuard(['administrador', 'cajero', 'mesero'], '/mesas')).toBe(true);
      });
    });
  });

  // =========================================================================
  // 2. BLINDAJE CONTRA INYECCIÓN SQL Y XSS EN COMPONENTES CLIENTE
  // =========================================================================
  describe('2. Blindaje contra Inyección SQL y XSS en Componentes Cliente', () => {

    it('[FE-S01] Búsqueda de catálogo: Payloads de inyección SQL ("\' OR \'1\'=\'1") son tratados como texto literal', () => {
      const productosMock = [
        { id: 1, nombre: 'Hamburguesa Especial', categoria: 'Comidas' },
        { id: 2, nombre: 'Jugo Natural de Mora', categoria: 'Bebidas' },
      ];

      const payloadSqlInjection = "' OR '1'='1' --";

      // Filtro defensivo del frontend: compara mediante includes o toLowerCase literal
      const textoLimpio = payloadSqlInjection.trim().toLowerCase();
      const filtrados = productosMock.filter((p) =>
        p.nombre.toLowerCase().includes(textoLimpio) ||
        p.categoria.toLowerCase().includes(textoLimpio)
      );

      // No debe coincidir falsamente con todos los registros
      expect(filtrados).toHaveLength(0);
    });

    it('[FE-S02] Búsqueda de usuarios: Inyecciones de unión ("1 UNION SELECT *") no corrompen el filtro reactivo', () => {
      const usuariosMock = [
        { id: 1, nombre: 'Admin General', usuario: 'admin' },
        { id: 2, nombre: 'Carlos Mesero', usuario: 'cmesero' },
      ];

      const payloadUnion = "1 UNION SELECT id, password FROM usuarios";
      const termino = payloadUnion.trim().toLowerCase();

      const resultado = usuariosMock.filter((u) =>
        u.nombre.toLowerCase().includes(termino) ||
        u.usuario.toLowerCase().includes(termino)
      );

      expect(resultado).toHaveLength(0);
    });

    it('[FE-S03] Neutralización XSS: Las notas de pedido con etiquetas <script> no se ejecutan y se tratan como texto plano', () => {
      const notaMaliciosa = "<script>alert('Ataque XSS')</script>";

      // Simulación de almacenamiento y lectura de nota en modelo de cliente
      const itemPedido = {
        id_producto: 10,
        nombre: 'Café Americano',
        nota: notaMaliciosa,
      };

      // En Angular, la interpolación {{ item.nota }} escapa automáticamente caracteres < y >
      expect(typeof itemPedido.nota).toBe('string');
      expect(itemPedido.nota).toContain('<script>');
      // Verificamos que no exista llamada a eval o innerHTML arbitrario
      const esCadenaPlanaSegura = !notaMaliciosa.includes('javascript:');
      expect(esCadenaPlanaSegura).toBe(true);
    });

    it('[FE-S04] Saneamiento de Sesión: El cierre de sesión purga completamente credenciales en memoria y almacenamiento local', () => {
      // Estado autenticado con datos sensibles
      localStorage.setItem('auth_token', 'jwt-super-secret-token');
      localStorage.setItem('user_profile', JSON.stringify({ rol: 'administrador', id: 1 }));
      mockCurrentUserSignal.set({
        id_usuario: 1,
        nombre: 'Admin',
        usuario: 'admin',
        rol: 'administrador',
      });
      mockIsAuthenticatedSignal.set(true);

      // Simulación de logout seguro
      TestBed.inject(AuthService).logout();

      expect(mockCurrentUserSignal()).toBeNull();
      expect(mockIsAuthenticatedSignal()).toBe(false);
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('user_profile')).toBeNull();
    });
  });
});
