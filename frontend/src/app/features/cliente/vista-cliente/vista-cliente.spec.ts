import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VistaClienteComponent } from './vista-cliente';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Producto } from '../../../core/models/producto.model';
import { UsuarioSesion } from '../../../core/models/usuario.model';

describe('VistaClienteComponent', () => {
  let component: VistaClienteComponent;
  let fixture: ComponentFixture<VistaClienteComponent>;
  let snackBar: MatSnackBar;

  let mockCurrentUserSignal = signal<UsuarioSesion | null>(null);
  let mockIsAuthenticatedSignal = signal<boolean>(false);

  const mockProductos: Producto[] = [
    {
      id_producto: 1,
      nombre: 'Pizza Especial',
      categoria: 'Pizzas',
      precio_venta: 28000,
      costo: 14000,
      disponible: true,
      controla_inventario: false,
      cantidad_inventario: 0,
      ingredientes_removibles: ['Cebolla', 'Champiñones'],
      imagen: null,
    },
    {
      id_producto: 2,
      nombre: 'Limonada Natural',
      categoria: 'Bebidas',
      precio_venta: 5000,
      costo: 1500,
      disponible: true,
      controla_inventario: false,
      cantidad_inventario: 0,
      ingredientes_removibles: [],
      imagen: null,
    },
  ];

  const mockRouter = {
    navigate: vi.fn(),
  };

  const mockCatalogoService = {
    obtenerProductos: vi.fn().mockReturnValue(of(mockProductos)),
  };

  const mockDomiciliosService = {
    crear: vi.fn().mockReturnValue(of({ numero_pedido: 101, totalCalculado: 28000 })),
    obtenerEstadoServicio: vi.fn().mockReturnValue(
      of({ activo: true, cajaAbierta: true, recibiendoDomicilios: true }),
    ),
    obtenerMisPedidos: vi.fn().mockReturnValue(of([])),
    obtenerPorId: vi.fn().mockReturnValue(
      of({ numero_pedido: 101, etapaOperativa: 'Pendiente' }),
    ),
  };

  const mockAuthService = {
    currentUser: mockCurrentUserSignal,
    isAuthenticated: mockIsAuthenticatedSignal,
    logout: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  let router: Router;

  beforeEach(async () => {
    mockCurrentUserSignal.set(null);
    mockIsAuthenticatedSignal.set(false);
    localStorage.clear();
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [VistaClienteComponent],
      providers: [
        provideRouter([]),
        { provide: CatalogoApiService, useValue: mockCatalogoService },
        { provide: DomiciliosApiService, useValue: mockDomiciliosService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VistaClienteComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    snackBar = fixture.debugElement.injector.get(MatSnackBar);
    vi.spyOn(snackBar, 'open').mockImplementation(() => ({ onAction: () => of(null) } as any));
    fixture.detectChanges();
  });

  it('debe crearse y cargar los productos de la carta del restaurante', () => {
    expect(component).toBeTruthy();
    expect(component.productos().length).toBe(2);
    expect(component.categorias()).toEqual(['Pizzas', 'Bebidas']);
  });

  it('debe filtrar productos por categoría', () => {
    component.filtrarPorCategoria('Bebidas');
    const filtrados = component.productosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Limonada Natural');
  });

  it('debe filtrar productos por término de búsqueda', () => {
    component.busqueda.set('pizza');
    const filtrados = component.productosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Pizza Especial');
  });

  it('debe agregar producto al carrito y redirigir a /cliente/carrito al solicitar domicilio', () => {
    component.solicitarDomicilio(mockProductos[0]);
    expect(component.carrito().length).toBe(1);
    expect(router.navigate).toHaveBeenCalledWith(['/cliente/carrito']);
  });

  it('debe alertar si el servicio de domicilios se encuentra inactivo al solicitar domicilio', () => {
    component.estadoServicio.set({
      activo: false,
      cajaAbierta: false,
      recibiendoDomicilios: false,
      motivo: 'Caja cerrada',
    });
    component.solicitarDomicilio(mockProductos[0]);
    expect(snackBar.open).toHaveBeenCalled();
  });

  it('debe validar dirección y teléfono al confirmar pedido de domicilio', () => {
    mockIsAuthenticatedSignal.set(true);
    component.solicitarDomicilio(mockProductos[0]);

    // Dirección vacía -> no debe confirmar
    component.direccionEntrega.set('');
    component.telefonoContacto.set('');
    component.confirmarPedido();
    expect(component.pedidoConfirmado()).toBeNull();

    // Dirección válida y teléfono válido -> debe confirmar
    component.direccionEntrega.set('Calle 10 # 5-23');
    component.telefonoContacto.set('3123456789');
    component.confirmarPedido();

    expect(component.pedidoConfirmado()).not.toBeNull();
    expect(component.pedidoConfirmado()?.codigo).toBe('DOM-101');
    expect(component.pedidoConfirmado()?.direccion).toBe('Calle 10 # 5-23');
    expect(snackBar.open).toHaveBeenCalled();
  });

  it('debe permitir navegar al login al invocar irALogin', () => {
    component.irALogin();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/cliente' },
    });
  });

  it('debe cerrar sesión al invocar cerrarSesion', () => {
    component.cerrarSesion();
    expect(mockAuthService.logout).toHaveBeenCalledWith('/cliente');
  });

  it('debe persistir los productos añadidos al carrito en localStorage', () => {
    component.agregarAlCarrito(mockProductos[0]);
    expect(component.carrito().length).toBe(1);
    expect(component.totalCartItems()).toBe(1);

    const guardado = localStorage.getItem('mesalista_cliente_carrito');
    expect(guardado).toBeTruthy();
    expect(JSON.parse(guardado!).length).toBe(1);
  });

  it('debe permitir cambiar a la vista de mis pedidos', () => {
    expect(component.vistaActiva()).toBe('carta');
    component.abrirMisPedidos();
    expect(component.vistaActiva()).toBe('mis-pedidos');
  });

  it('debe navegar a la vista del carrito al iniciar checkout o abrir carrito si está autenticado', () => {
    mockIsAuthenticatedSignal.set(true);
    component.iniciarCheckout();
    expect(router.navigate).toHaveBeenCalledWith(['/cliente/carrito']);
  });

  it('debe solicitar autenticación al abrir carrito si no está autenticado', () => {
    mockIsAuthenticatedSignal.set(false);
    component.abrirCarrito();
    expect(component.mostrarModalAuth()).toBe(true);
    expect(snackBar.open).toHaveBeenCalled();
  });
});
