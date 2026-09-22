import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ProductoFormComponent } from './producto-form';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { of } from 'rxjs';

describe('ProductoFormComponent', () => {
  let component: ProductoFormComponent;
  let fixture: ComponentFixture<ProductoFormComponent>;
  let catalogoApiSpy: any;

  beforeEach(async () => {
    catalogoApiSpy = {
      obtenerCategorias: vi.fn().mockReturnValue(of(['Bebidas', 'Hamburguesas'])),
      obtenerProductos: vi.fn().mockReturnValue(of([])),
      obtenerPorId: vi.fn(),
      crearProducto: vi.fn().mockReturnValue(of({ id_producto: 1, nombre: 'Pizza Margarita' })),
      actualizarProducto: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProductoFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: CatalogoApiService, useValue: catalogoApiSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductoFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe inicializar el formulario con validaciones requeridas y control de stock inactivo por defecto', () => {
    expect(component.productForm).toBeDefined();
    expect(component.productForm.get('nombre')?.valid).toBe(false);
    expect(component.productForm.get('controla_inventario')?.value).toBe(false);
    expect(component.productForm.get('cantidad_inventario')?.disabled).toBe(true);
  });

  it('debe activar y exigir cantidad_inventario al activar controla_inventario', () => {
    component.productForm.get('controla_inventario')?.setValue(true);
    expect(component.productForm.get('cantidad_inventario')?.enabled).toBe(true);

    component.productForm.get('cantidad_inventario')?.setValue(null);
    expect(component.productForm.get('cantidad_inventario')?.valid).toBe(false);

    component.productForm.get('cantidad_inventario')?.setValue(15);
    expect(component.productForm.get('cantidad_inventario')?.valid).toBe(true);
  });

  it('debe permitir crear una categoría personalizada y seleccionarla en el formulario', () => {
    component.guardarNuevaCategoria('Pizzas Artesanales');

    expect(component.categorias()).toContain('Pizzas Artesanales');
    expect(component.productForm.get('categoria')?.value).toBe('Pizzas Artesanales');
    expect(component.modoNuevaCategoria()).toBe(false);
  });

  it('debe normalizar la categoría personalizada con mayúscula inicial', () => {
    component.guardarNuevaCategoria('mariscos frescos');

    expect(component.categorias()).toContain('Mariscos frescos');
    expect(component.productForm.get('categoria')?.value).toBe('Mariscos frescos');
  });

  it('debe mostrar mensaje de error al intentar guardar con campos vacíos', () => {
    component.onSave();

    expect(component.mensajeFeedback()?.tipo).toBe('error');
    expect(component.mensajeFeedback()?.texto).toContain('No se puede guardar el producto');
  });
});
