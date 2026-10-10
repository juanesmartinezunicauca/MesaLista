import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewDeliveryDialogComponent } from './nuevo-domi-modal';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Producto } from '../../../core/models';

describe('NewDeliveryDialogComponent', () => {
  let component: NewDeliveryDialogComponent;
  let fixture: ComponentFixture<NewDeliveryDialogComponent>;

  const mockProductos: Producto[] = [
    {
      id_producto: 1,
      nombre: 'Hamburguesa Especial',
      categoria: 'Hamburguesas',
      precio_venta: 25000,
      costo: 12000,
      disponible: true,
      controla_inventario: true,
      cantidad_inventario: 10,
      ingredientes_removibles: ['Cebolla', 'Tomate'],
    },
    {
      id_producto: 2,
      nombre: 'Jugo Natural',
      categoria: 'Bebidas',
      precio_venta: 6000,
      costo: 2000,
      disponible: true,
      controla_inventario: false,
      cantidad_inventario: 0,
      ingredientes_removibles: [],
    },
  ];

  let fakeCatalogoApi: {
    obtenerProductos: () => any;
  };

  let fakeDomiciliosApi: {
    crear: (payload: any) => any;
  };

  let fakeDialogRef: {
    close: (res?: any) => void;
  };

  beforeEach(async () => {
    fakeCatalogoApi = {
      obtenerProductos: vi.fn().mockReturnValue(of(mockProductos)),
    };

    fakeDomiciliosApi = {
      crear: vi.fn().mockReturnValue(of({ id_pedido: 99 })),
    };

    fakeDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NewDeliveryDialogComponent],
      providers: [
        { provide: CatalogoApiService, useValue: fakeCatalogoApi },
        { provide: DomiciliosApiService, useValue: fakeDomiciliosApi },
        { provide: MatDialogRef, useValue: fakeDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewDeliveryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y cargar productos del catálogo', () => {
    expect(component).toBeTruthy();
    expect(component.productosCatalogo().length).toBe(2);
  });

  it('debe inicializar el formulario con método de pago Efectivo por defecto', () => {
    expect(component.deliveryForm.get('metodoPago')?.value).toBe('Efectivo');
  });

  it('debe agregar un producto y calcular el total', () => {
    component.agregarProducto(mockProductos[0]); // 25.000 x 1
    expect(component.itemsSeleccionados().length).toBe(1);
    expect(component.totalPedido()).toBe(25000);

    component.agregarProducto(mockProductos[0]); // 25.000 x 2
    expect(component.itemsSeleccionados().length).toBe(1);
    expect(component.itemsSeleccionados()[0].cantidad).toBe(2);
    expect(component.totalPedido()).toBe(50000);

    component.agregarProducto(mockProductos[1]); // 6.000 x 1
    expect(component.itemsSeleccionados().length).toBe(2);
    expect(component.totalPedido()).toBe(56000);
  });

  it('debe decrementar y eliminar productos del pedido', () => {
    component.agregarProducto(mockProductos[0]); // qty 1
    component.agregarProducto(mockProductos[0]); // qty 2

    component.decrementarItem(1); // qty 1
    expect(component.itemsSeleccionados()[0].cantidad).toBe(1);

    component.decrementarItem(1); // removed
    expect(component.itemsSeleccionados().length).toBe(0);
  });

  it('debe enviar el formulario y llamar a domiciliosApi.crear si es válido', () => {
    component.deliveryForm.setValue({
      nombreCompleto: 'Laura Restrepo',
      telefono: '3109876543',
      direccion: 'Carrera 7 # 12-34',
      email: 'laura@example.com',
      metodoPago: 'Transferencia',
      notas: 'Timbre 201',
    });

    component.agregarProducto(mockProductos[0]);

    component.onSave();

    expect(fakeDomiciliosApi.crear).toHaveBeenCalledWith({
      cliente: {
        nombre: 'Laura Restrepo',
        telefono: '3109876543',
        direccion: 'Carrera 7 # 12-34',
        email: 'laura@example.com',
      },
      metodo_pago: 'Transferencia',
      observacion: 'Timbre 201',
      items: [
        {
          id_producto: 1,
          cantidad: 1,
          ingredientes_removidos: undefined,
          observacion: undefined,
        },
      ],
    });
    expect(fakeDialogRef.close).toHaveBeenCalledWith({ id_pedido: 99 });
  });
});
