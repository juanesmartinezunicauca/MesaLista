import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VistaCarritoComponent } from './vista-carrito';
import { CarritoService } from '../../../core/services/carrito/carrito.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Producto } from '../../../core/models/producto.model';
import { UsuarioSesion } from '../../../core/models/usuario.model';

describe('VistaCarritoComponent', () => {
  let component: VistaCarritoComponent;
  let fixture: ComponentFixture<VistaCarritoComponent>;
  let carritoService: CarritoService;
  let crearDomicilioMock: ReturnType<typeof vi.fn>;
  let snackBarOpenMock: ReturnType<typeof vi.fn>;

  const productoMock: Producto = {
    id_producto: 10,
    nombre: 'Hamburguesa Doble',
    categoria: 'Hamburguesas',
    precio_venta: 20000,
    costo: 9000,
    cantidad_inventario: 20,
    controla_inventario: true,
    disponible: true,
    ingredientes_removibles: ['Cebolla', 'Tomate'],
  };

  beforeEach(async () => {
    localStorage.clear();
    crearDomicilioMock = vi.fn().mockReturnValue(
      of({
        id_pedido: 77,
        numero_pedido: 15,
        totalCalculado: 23000,
      }),
    );
    snackBarOpenMock = vi.fn();

    await TestBed.configureTestingModule({
      imports: [VistaCarritoComponent],
      providers: [
        provideRouter([]),
        CarritoService,
        {
          provide: DomiciliosApiService,
          useValue: { crear: crearDomicilioMock },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal<UsuarioSesion | null>({
              id_usuario: 9,
              nombre: 'Juan Perez',
              usuario: 'jperez',
              email: 'juan@ejemplo.com',
              rol: 'cliente',
            }),
            isAuthenticated: signal(true),
          },
        },
        {
          provide: MatSnackBar,
          useValue: { open: snackBarOpenMock },
        },
      ],
    }).compileComponents();

    carritoService = TestBed.inject(CarritoService);
    carritoService.vaciarCarrito();
    carritoService.agregarAlCarrito(productoMock, ['Cebolla'], 'Salsa aparte');

    fixture = TestBed.createComponent(VistaCarritoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debe mostrar en el botón Enviar Domicilio el total sumando productos + costo de domicilio', () => {
    // Barrio por defecto: Catay -> Zona Cercana ($3.000). Producto: $20.000 => Total $23.000
    expect(component.costoEnvio()).toBe(3000);
    expect(component.totalConEnvio()).toBe(23000);

    const btnHeader: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.btn-submit-order-header',
    );
    expect(btnHeader?.textContent).toContain('Enviar Domicilio');
    expect(btnHeader?.textContent).toContain('23,000');

    // Al cambiar de barrio a Zona Sur ($6.000), el botón actualiza el total a $26.000
    component.cambiarBarrio('La Esmeralda');
    fixture.detectChanges();
    expect(component.costoEnvio()).toBe(6000);
    expect(component.totalConEnvio()).toBe(26000);
    expect(btnHeader?.textContent).toContain('26,000');
  });

  it('debe abrir el modal de resumen para confirmar en lugar de enviar directamente al pulsar Enviar Domicilio', () => {
    component.nombreCliente.set('Juan Perez');
    component.telefonoContacto.set('3123456789');
    component.direccionEntrega.set('Calle 15 # 8-42');
    fixture.detectChanges();

    const btnHeader: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.btn-submit-order-header',
    );
    btnHeader.click();
    fixture.detectChanges();

    expect(crearDomicilioMock).not.toHaveBeenCalled();
    expect(component.resumenPreConfirmacion()).not.toBeNull();
    expect(component.resumenPreConfirmacion()?.subtotalProductos).toBe(20000);
    expect(component.resumenPreConfirmacion()?.costoEnvio).toBe(3000);
    expect(component.resumenPreConfirmacion()?.total).toBe(23000);

    const modalResumen = fixture.nativeElement.querySelector('.confirm-summary-window');
    expect(modalResumen).not.toBeNull();
    expect(modalResumen.textContent).toContain('Confirma tu Pedido a Domicilio');
    expect(modalResumen.textContent).toContain('Hamburguesa Doble');
    expect(modalResumen.textContent).toContain('Sin Cebolla');
    expect(modalResumen.textContent).toContain('23,000');
  });

  it('debe permitir volver a editar cerrando el modal sin enviar el pedido', () => {
    component.nombreCliente.set('Juan Perez');
    component.telefonoContacto.set('3123456789');
    component.direccionEntrega.set('Calle 15 # 8-42');
    component.abrirResumenConfirmacion();
    fixture.detectChanges();

    const btnVolver: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-back-edit');
    btnVolver.click();
    fixture.detectChanges();

    expect(component.resumenPreConfirmacion()).toBeNull();
    expect(crearDomicilioMock).not.toHaveBeenCalled();
  });

  it('debe enviar el domicilio al confirmar en el modal y preservar el total real en el modal exitoso y WhatsApp', () => {
    component.nombreCliente.set('Juan Perez');
    component.telefonoContacto.set('3123456789');
    component.direccionEntrega.set('Calle 15 # 8-42');
    component.metodoPago.set('Transferencia');
    component.abrirResumenConfirmacion();
    fixture.detectChanges();

    const btnConfirmar: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-confirm-send');
    btnConfirmar.click();
    fixture.detectChanges();

    expect(crearDomicilioMock).toHaveBeenCalledTimes(1);
    expect(crearDomicilioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 3000,
        metodo_pago: 'Transferencia',
        es_pedido_cliente: true,
      }),
    );

    expect(component.resumenPreConfirmacion()).toBeNull();
    expect(component.pedidoConfirmado()?.total).toBe(23000);
    expect(carritoService.carrito().length).toBe(0);

    const linkWhatsapp: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.btn-send-receipt');
    expect(linkWhatsapp?.href).toContain('23.000');
  });
});
