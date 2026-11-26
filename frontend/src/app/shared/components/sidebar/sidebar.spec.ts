import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DomiciliosNotificacionService } from '../../../core/services/events/domicilios-notificacion.service';
import { UsuarioSesion } from '../../../core/models/usuario.model';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockCurrentUser = signal<UsuarioSesion | null>(null);
  let mockPendientesCount = signal<number>(0);
  let iniciarMonitoreoMock: ReturnType<typeof vi.fn>;
  let detenerMonitoreoMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCurrentUser.set(null);
    mockPendientesCount.set(0);
    iniciarMonitoreoMock = vi.fn();
    detenerMonitoreoMock = vi.fn();

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: mockCurrentUser,
          },
        },
        {
          provide: DomiciliosNotificacionService,
          useValue: {
            pendientesCount: mockPendientesCount,
            iniciarMonitoreo: iniciarMonitoreoMock,
            detenerMonitoreo: detenerMonitoreoMock,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe filtrar las vistas para el rol mesero mostrando únicamente Mesas y Domicilios', () => {
    mockCurrentUser.set({
      id_usuario: 1,
      nombre: 'Pedro Mesero',
      usuario: 'pmesero',
      rol: 'mesero',
    });
    fixture.detectChanges();

    const items = component.navItemsFiltrados();
    const rutas = items.map((i) => i.route);

    expect(rutas).toContain('/mesas');
    expect(rutas).toContain('/domicilios');
    expect(rutas).not.toContain('/caja');
    expect(rutas).not.toContain('/catalogo');
    expect(rutas).not.toContain('/usuarios');
    expect(rutas).not.toContain('/reportes');
  });

  it('debe permitir ver todas las secciones al rol administrador', () => {
    mockCurrentUser.set({
      id_usuario: 2,
      nombre: 'Administrador Principal',
      usuario: 'admin',
      rol: 'administrador',
    });
    fixture.detectChanges();

    const items = component.navItemsFiltrados();
    const rutas = items.map((i) => i.route);

    expect(rutas).toEqual([
      '/mesas',
      '/cocina',
      '/domicilios',
      '/caja',
      '/catalogo',
      '/usuarios',
      '/historial',
      '/reportes',
    ]);
  });

  it('debe mostrar Mesas, Domicilios, Caja y Catálogo al rol cajero (sin Personal ni Reportes)', () => {
    mockCurrentUser.set({
      id_usuario: 3,
      nombre: 'Lucía Cajera',
      usuario: 'lcajera',
      rol: 'cajero',
    });
    fixture.detectChanges();

    const items = component.navItemsFiltrados();
    const rutas = items.map((i) => i.route);

    expect(rutas).toContain('/mesas');
    expect(rutas).toContain('/domicilios');
    expect(rutas).toContain('/caja');
    expect(rutas).toContain('/catalogo');
    expect(rutas).not.toContain('/usuarios');
    expect(rutas).not.toContain('/reportes');
  });

  it('debe mostrar el círculo numérico de notificación en Domicilios cuando existen solicitudes pendientes', () => {
    mockCurrentUser.set({
      id_usuario: 2,
      nombre: 'Administrador Principal',
      usuario: 'admin',
      rol: 'administrador',
    });
    mockPendientesCount.set(0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nav-badge')).toBeNull();
    expect(iniciarMonitoreoMock).toHaveBeenCalled();

    mockPendientesCount.set(4);
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.nav-badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent.trim()).toBe('4');

    mockPendientesCount.set(120);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nav-badge')?.textContent.trim()).toBe('99+');
  });
});
