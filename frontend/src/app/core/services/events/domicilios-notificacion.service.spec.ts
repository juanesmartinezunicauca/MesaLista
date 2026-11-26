import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DomiciliosNotificacionService } from './domicilios-notificacion.service';
import { DomiciliosApiService } from '../api/domicilios-api.service';
import { AuthService } from '../auth/auth.service';
import { UsuarioSesion } from '../../models/usuario.model';
import { Domicilio } from '../../models';

describe('DomiciliosNotificacionService', () => {
  let service: DomiciliosNotificacionService;
  let mockCurrentUser = signal<UsuarioSesion | null>(null);
  let obtenerTodosMock: ReturnType<typeof vi.fn>;

  const crearDomicilioMock = (
    id: number,
    etapaOperativa: Domicilio['etapaOperativa'],
  ): Domicilio =>
    ({
      id_pedido: id,
      numero_pedido: 100 + id,
      tipo: 'domicilio',
      estado: 'enviada',
      etapaOperativa,
      totalCalculado: 25000,
      fecha_hora: '2026-11-25T19:00:00Z',
      id_cliente: id,
      id_usuario: 1,
      cliente: {
        id_cliente: id,
        nombre: `Cliente ${id}`,
        telefono: '3001112233',
        direccion: 'Calle 5 # 1-10',
      },
      items: [],
    }) as Domicilio;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCurrentUser = signal<UsuarioSesion | null>(null);
    obtenerTodosMock = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        DomiciliosNotificacionService,
        {
          provide: AuthService,
          useValue: { currentUser: mockCurrentUser },
        },
        {
          provide: DomiciliosApiService,
          useValue: { obtenerTodos: obtenerTodosMock },
        },
      ],
    });

    service = TestBed.inject(DomiciliosNotificacionService);
  });

  afterEach(() => {
    service.detenerMonitoreo();
    vi.useRealTimers();
  });

  it('no debe consultar ni mostrar notificaciones cuando el rol no tiene acceso a domicilios', () => {
    mockCurrentUser.set({
      id_usuario: 5,
      nombre: 'Chef Cocina',
      usuario: 'cocina1',
      rol: 'cocina',
    });

    service.iniciarMonitoreo();

    expect(obtenerTodosMock).not.toHaveBeenCalled();
    expect(service.pendientesCount()).toBe(0);
  });

  it('debe consultar domicilios pendientes al iniciar monitoreo para roles autorizados y actualizar el contador', () => {
    mockCurrentUser.set({
      id_usuario: 1,
      nombre: 'Cajero Turno',
      usuario: 'cajero1',
      rol: 'cajero',
    });

    obtenerTodosMock.mockReturnValue(
      of([
        crearDomicilioMock(1, 'Pendiente'),
        crearDomicilioMock(2, 'Pendiente'),
        crearDomicilioMock(3, 'En Preparación'),
      ]),
    );

    service.iniciarMonitoreo();

    expect(obtenerTodosMock).toHaveBeenCalledWith({ estado: 'Pendiente' });
    expect(service.pendientesCount()).toBe(2);
  });

  it('debe volver a consultar periódicamente cada 10 segundos y detenerse al llamar detenerMonitoreo', () => {
    mockCurrentUser.set({
      id_usuario: 2,
      nombre: 'Admin',
      usuario: 'admin',
      rol: 'administrador',
    });

    obtenerTodosMock
      .mockReturnValueOnce(of([crearDomicilioMock(1, 'Pendiente')]))
      .mockReturnValueOnce(
        of([
          crearDomicilioMock(1, 'Pendiente'),
          crearDomicilioMock(2, 'Pendiente'),
          crearDomicilioMock(3, 'Pendiente'),
        ]),
      );

    service.iniciarMonitoreo();
    expect(service.pendientesCount()).toBe(1);

    vi.advanceTimersByTime(10_000);
    expect(obtenerTodosMock).toHaveBeenCalledTimes(2);
    expect(service.pendientesCount()).toBe(3);

    service.detenerMonitoreo();
    vi.advanceTimersByTime(30_000);
    expect(obtenerTodosMock).toHaveBeenCalledTimes(2);
  });

  it('debe sincronizar el contador inmediatamente desde una lista local', () => {
    service.sincronizarDesdeLista([
      crearDomicilioMock(1, 'Pendiente'),
      crearDomicilioMock(2, 'En Reparto'),
      crearDomicilioMock(3, 'Pendiente'),
    ]);
    expect(service.pendientesCount()).toBe(2);

    service.sincronizarDesdeLista([crearDomicilioMock(1, 'En Preparación')]);
    expect(service.pendientesCount()).toBe(0);
  });

  it('debe tolerar errores de red sin romper el contador actual ni bloquear futuras consultas', () => {
    mockCurrentUser.set({
      id_usuario: 3,
      nombre: 'Mesero',
      usuario: 'mesero1',
      rol: 'mesero',
    });

    obtenerTodosMock
      .mockReturnValueOnce(of([crearDomicilioMock(1, 'Pendiente')]))
      .mockReturnValueOnce(throwError(() => new Error('Network error')))
      .mockReturnValueOnce(of([]));

    service.refrescar();
    expect(service.pendientesCount()).toBe(1);

    service.refrescar();
    expect(service.pendientesCount()).toBe(1);

    service.refrescar();
    expect(service.pendientesCount()).toBe(0);
  });
});
