import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsuarioSesion } from '../../../core/models/usuario.model';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockCurrentUser = signal<UsuarioSesion | null>(null);

  beforeEach(async () => {
    mockCurrentUser.set(null);

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
      '/domicilios',
      '/caja',
      '/catalogo',
      '/usuarios',
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
});
