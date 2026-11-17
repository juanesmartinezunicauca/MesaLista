import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { VistaHistorialComponent } from './vista-historial';
import { CajaApiService } from '../../../core/services/api/caja-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { PedidosApiService } from '../../../core/services/api/pedidos-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('VistaHistorialComponent', () => {
  let component: VistaHistorialComponent;
  let fixture: ComponentFixture<VistaHistorialComponent>;

  const mockCajaApi = {
    obtenerHistorial: vi.fn().mockReturnValue(of([])),
    obtenerGastos: vi.fn().mockReturnValue(of([])),
  };
  const mockFacturacionApi = {
    obtenerTodas: vi.fn().mockReturnValue(of([])),
  };
  const mockPedidosApi = {
    obtenerTodos: vi.fn().mockReturnValue(of([])),
  };
  const mockDomiciliosApi = {
    obtenerTodos: vi.fn().mockReturnValue(of([])),
  };
  const mockCatalogoApi = {
    obtenerProductos: vi.fn().mockReturnValue(of([])),
  };
  const mockAuthService = {
    userRole: signal('administrador'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [VistaHistorialComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: CajaApiService, useValue: mockCajaApi },
        { provide: FacturacionApiService, useValue: mockFacturacionApi },
        { provide: PedidosApiService, useValue: mockPedidosApi },
        { provide: DomiciliosApiService, useValue: mockDomiciliosApi },
        { provide: CatalogoApiService, useValue: mockCatalogoApi },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VistaHistorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y cargar turnos de caja sin filtro de fechas por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.presetFecha()).toBe('todos');
    expect(mockCajaApi.obtenerHistorial).toHaveBeenCalledWith({
      limite: 30,
      fecha_inicio: undefined,
      fecha_fin: undefined,
    });
  });

  it('debe propagar rango de fechas personalizado al cambiar entre las 5 pestañas', () => {
    component.actualizarFechaPersonalizada('inicio', '2026-11-01');
    component.actualizarFechaPersonalizada('fin', '2026-11-15');

    expect(mockCajaApi.obtenerHistorial).toHaveBeenLastCalledWith({
      limite: 200,
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });

    component.cambiarTab('facturas');
    expect(mockFacturacionApi.obtenerTodas).toHaveBeenCalledWith({
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });

    component.cambiarTab('pedidos');
    expect(mockPedidosApi.obtenerTodos).toHaveBeenCalledWith({
      tipo: 'salon',
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });

    component.cambiarTab('domicilios');
    expect(mockDomiciliosApi.obtenerTodos).toHaveBeenCalledWith({
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });

    component.cambiarTab('gastos');
    expect(mockCajaApi.obtenerGastos).toHaveBeenCalledWith({
      limite: 200,
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });
  });

  it('debe validar que fechaInicio no sea posterior a fechaFin antes de consultar API', () => {
    const snackBar = fixture.debugElement.injector.get(MatSnackBar);
    const spySnack = vi.spyOn(snackBar, 'open').mockImplementation(() => ({}) as any);
    vi.clearAllMocks();

    component.fechaInicio.set('2026-11-20');
    component.actualizarFechaPersonalizada('fin', '2026-11-10');

    expect(mockCajaApi.obtenerHistorial).not.toHaveBeenCalled();
    expect(spySnack).toHaveBeenCalled();
  });

  it('debe limpiar filtros de fechas y restaurar preset todos', () => {
    component.aplicarPresetFecha('hoy');
    expect(component.hayFiltroFecha()).toBe(true);

    component.limpiarFiltroFecha();
    expect(component.presetFecha()).toBe('todos');
    expect(component.hayFiltroFecha()).toBe(false);
  });
});

