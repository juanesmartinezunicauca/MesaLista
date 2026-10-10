import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { UsuarioDialogComponent, UsuarioDialogData } from './usuario-dialog';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UsuariosApiService } from '../../../core/services/api/usuarios-api.service';
import { of } from 'rxjs';

describe('UsuarioDialogComponent', () => {
  let component: UsuarioDialogComponent;
  let fixture: ComponentFixture<UsuarioDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockUsuariosApi = {
    crear: vi.fn().mockReturnValue(
      of({
        id_usuario: 10,
        nombre: 'Nuevo Empleado',
        usuario: 'empleado',
        email: 'empleado@gmail.com',
        rol: 'mesero',
        estado: 'activo',
      })
    ),
    actualizar: vi.fn().mockReturnValue(
      of({
        id_usuario: 10,
        nombre: 'Empleado Editado',
        usuario: 'empleado',
        email: 'empleado@gmail.com',
        rol: 'mesero',
        estado: 'activo',
      })
    ),
  };

  const configureTestBed = async (data: UsuarioDialogData = {}) => {
    await TestBed.configureTestingModule({
      imports: [UsuarioDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: UsuariosApiService, useValue: mockUsuariosApi },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuarioDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe inicializar el formulario exigiendo correo y permitiendo contraseña vacía (delegación OAuth)', async () => {
    await configureTestBed();

    expect(component.usuarioForm.get('email')?.valid).toBe(false); // requerido
    expect(component.usuarioForm.get('password')?.valid).toBe(true); // opcional

    component.usuarioForm.patchValue({
      nombre: 'Carlos Mesero',
      email: 'carlos.mesero@gmail.com',
      rol: 'mesero',
    });

    expect(component.usuarioForm.valid).toBe(true);
  });

  it('debe registrar colaborador con OAuth pre-autorizado sin requerir contraseña local', async () => {
    await configureTestBed();

    component.usuarioForm.patchValue({
      nombre: 'Carlos Mesero',
      email: 'carlos.mesero@gmail.com',
      rol: 'mesero',
    });

    component.guardar();

    expect(mockUsuariosApi.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Carlos Mesero',
        email: 'carlos.mesero@gmail.com',
        usuario: 'carlos.mesero',
        rol: 'mesero',
        estado: 'activo',
      })
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'creado' })
    );
  });
});
