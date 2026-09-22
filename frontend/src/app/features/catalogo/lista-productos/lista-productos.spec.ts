import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaProductosComponent } from './lista-productos';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { of } from 'rxjs';
import { Producto } from '../../../core/models/producto.model';
import { provideRouter } from '@angular/router';

describe('ListaProductosComponent', () => {
  let component: ListaProductosComponent;
  let fixture: ComponentFixture<ListaProductosComponent>;

  const mockProductos: Producto[] = [
    {
      id_producto: 1,
      nombre: 'Hamburguesa Clásica',
      categoria: 'Hamburguesas',
      precio_venta: 22000,
      costo: 10000,
      cantidad_inventario: 20,
      controla_inventario: false,
      disponible: true,
      ingredientes_removibles: ['Cebolla', 'Tomate'],
    },
    {
      id_producto: 2,
      nombre: 'Salchipapa Especial',
      categoria: 'Comidas Rápidas',
      precio_venta: 18000,
      costo: 8000,
      cantidad_inventario: 4,
      controla_inventario: false,
      disponible: true,
      ingredientes_removibles: ['Tártara'],
    },
    {
      id_producto: 3,
      nombre: 'Gaseosa 400ml',
      categoria: 'Bebidas',
      precio_venta: 5000,
      costo: 2500,
      cantidad_inventario: 0,
      controla_inventario: true,
      disponible: false,
      ingredientes_removibles: [],
    },
  ];

  let llamadoObtenerProductos = false;
  const fakeCatalogoApi = {
    obtenerProductos: () => {
      llamadoObtenerProductos = true;
      return of(mockProductos);
    },
    cambiarDisponibilidad: () => of({} as Producto),
    eliminarProducto: () => of(void 0),
  };

  beforeEach(async () => {
    llamadoObtenerProductos = false;
    await TestBed.configureTestingModule({
      imports: [ListaProductosComponent],
      providers: [
        { provide: CatalogoApiService, useValue: fakeCatalogoApi },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaProductosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente y cargar productos al iniciar', () => {
    expect(component).toBeTruthy();
    expect(llamadoObtenerProductos).toBe(true);
    expect(component.productos().length).toBe(3);
  });

  it('debe calcular métricas del catálogo correctamente', () => {
    const metricas = component.metricas();
    expect(metricas.total).toBe(3);
    expect(metricas.disponibles).toBe(2);
    expect(metricas.agotados).toBe(1);
    expect(metricas.bajoStock).toBe(1); // Solo Gaseosa (0) controla stock; las comidas no generan bajo stock
  });

  it('debe asignar etiqueta de stock solo a productos con control de stock activo', () => {
    const filtrados = component.productosFiltrados();
    const hamburguesa = filtrados.find((p) => p.id_producto === 1);
    const gaseosa = filtrados.find((p) => p.id_producto === 3);

    expect(hamburguesa?.controla_inventario).toBe(false);
    expect(hamburguesa?.etiquetaStock).toBe('');

    expect(gaseosa?.controla_inventario).toBe(true);
    expect(gaseosa?.etiquetaStock).toBe('Sin stock');
    expect(gaseosa?.claseStock).toBe('out-of-stock');
  });

  it('debe filtrar productos por término de búsqueda', () => {
    component.busqueda.set('salchi');
    const filtrados = component.productosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Salchipapa Especial');
  });

  it('debe filtrar productos por categoría', () => {
    component.categoriaSeleccionada.set('Hamburguesas');
    const filtrados = component.productosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Hamburguesa Clásica');
  });

  it('debe filtrar productos por disponibilidad', () => {
    component.filtroDisponibilidad.set('agotados');
    const filtrados = component.productosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Gaseosa 400ml');
  });

  it('debe calcular el margen porcentual correctamente', () => {
    expect(component.calcularMargen(20000, 10000)).toBe('50%');
    expect(component.calcularMargen(0, 0)).toBe('0%');
  });
});
