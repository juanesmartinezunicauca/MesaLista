import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ListaUsuariosComponent } from './lista-usuarios';
import { UsuariosApiService } from '../../../core/services/api/usuarios-api.service';
import { Usuario } from '../../../core/models/usuario.model';

describe('ListaUsuariosComponent', () => {
  let component: ListaUsuariosComponent;
  let fixture: ComponentFixture<ListaUsuariosComponent>;

  let llamadoObtenerTodos = false;
  let ultimoEstadoCambiado: { id: number; estado: string } | null = null;

  const mockListaUsuarios: Usuario[] = [
    {
      id_usuario: 1,
      nombre: 'Administrador del Sistema',
      usuario: 'admin',
      rol: 'administrador',
      estado: 'activo',
    },
    {
      id_usuario: 2,
      nombre: 'Carlos Mesero',
      usuario: 'cmesero',
      rol: 'mesero',
      estado: 'activo',
    },
    {
      id_usuario: 3,
      nombre: 'Ana Cajera',
      usuario: 'acajera',
      rol: 'cajero',
      estado: 'inactivo',
    },
    {
      id_usuario: 4,
      nombre: 'Pedro Cocina',
      usuario: 'pcocina',
      rol: 'cocina',
      estado: 'activo',
    },
  ];

  const fakeUsuariosApi = {
    obtenerTodos: () => {
      llamadoObtenerTodos = true;
      return of(mockListaUsuarios);
    },
    cambiarEstado: (id: number, estado: any) => {
      ultimoEstadoCambiado = { id, estado };
      return of({ ...mockListaUsuarios[1], estado });
    },
    eliminar: (id: number) => of({ mensaje: 'Eliminado', tipo: 'hard-delete' as const, id_usuario: id }),
  };

  beforeEach(async () => {
    llamadoObtenerTodos = false;
    ultimoEstadoCambiado = null;

    await TestBed.configureTestingModule({
      imports: [ListaUsuariosComponent],
      providers: [
        provideHttpClient(),
        { provide: UsuariosApiService, useValue: fakeUsuariosApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaUsuariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente y cargar usuarios al iniciar', () => {
    expect(component).toBeTruthy();
    expect(llamadoObtenerTodos).toBe(true);
    expect(component.usuarios().length).toBe(4);
  });

  it('debe calcular métricas del personal adecuadamente', () => {
    const metricas = component.metricas();
    expect(metricas.total).toBe(4);
    expect(metricas.activos).toBe(3);
    expect(metricas.inactivos).toBe(1);
    expect(metricas.administradores).toBe(1);
    expect(metricas.meseros).toBe(1);
    expect(metricas.cajeros).toBe(1);
    expect(metricas.cocina).toBe(1);
  });

  it('debe filtrar por rol operativo', () => {
    component.filtroRol.set('mesero');
    const filtrados = component.usuariosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].usuario).toBe('cmesero');
  });

  it('debe filtrar por estado activo/inactivo', () => {
    component.filtroEstado.set('inactivo');
    const filtrados = component.usuariosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].usuario).toBe('acajera');
  });

  it('debe buscar usuarios por nombre o username en tiempo real', () => {
    component.busqueda.set('carlos');
    let filtrados = component.usuariosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Carlos Mesero');

    component.busqueda.set('admin');
    filtrados = component.usuariosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].usuario).toBe('admin');
  });

  it('debe cambiar el estado operativo de un usuario', () => {
    const mesero = component.usuarios()[1];
    component.toggleEstado(mesero);

    expect(ultimoEstadoCambiado).toEqual({ id: 2, estado: 'inactivo' });
    const meseroActualizado = component.usuarios().find((u) => u.id_usuario === 2);
    expect(meseroActualizado?.estado).toBe('inactivo');
  });
});
