import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { FacturaDialogComponent } from './factura-dialog';
import { Mesa } from '../models/mesa.model';

describe('FacturaDialogComponent', () => {
  let component: FacturaDialogComponent;
  let fixture: ComponentFixture<FacturaDialogComponent>;
  let dialogRefSpy: { close: any };

  const mockMesa: Mesa = {
    id_mesa: 1,
    numero: 1,
    estado_bd: 'ocupada',
    estado_visual: 'ocupada',
    mesero_actual: 'Carlos Mesero',
    total_acumulado: 45000,
    borrador_local: [],
    pedidos: [
      {
        id_pedido: 101,
        numero_pedido: 1,
        tipo: 'salon',
        estado: 'enviada',
        fecha_hora: new Date().toISOString(),
        subtotal: 35000,
        items: [
          {
            id_item: 1,
            id_producto: 1,
            nombre: 'Bandeja Paisa',
            cantidad: 1,
            precio_unitario: 35000,
            subtotal: 35000,
          },
        ],
      },
      {
        id_pedido: 102,
        numero_pedido: 2,
        tipo: 'salon',
        estado: 'enviada',
        fecha_hora: new Date().toISOString(),
        subtotal: 10000,
        items: [
          {
            id_item: 2,
            id_producto: 2,
            nombre: 'Jugo Natural',
            cantidad: 2,
            precio_unitario: 5000,
            subtotal: 10000,
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FacturaDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MAT_DIALOG_DATA, useValue: { mesa: mockMesa } },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FacturaDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe consolidar los ítems de todos los pedidos y calcular el subtotal', () => {
    const items = component.itemsConsolidados();
    expect(items.length).toBe(2);
    expect(items[0].nombre).toBe('Bandeja Paisa');
    expect(items[1].nombre).toBe('Jugo Natural');
    expect(items[1].cantidad).toBe(2);
    expect(component.subtotal()).toBe(45000);
  });

  it('debe calcular la propina sugerida del 10% por defecto', () => {
    expect(component.tipoPropina()).toBe('diez');
    expect(component.montoPropina()).toBe(4500);
    expect(component.totalFinal()).toBe(49500);
  });

  it('debe permitir cambiar la propina a 0% o personalizada', () => {
    component.setTipoPropina('cero');
    expect(component.montoPropina()).toBe(0);
    expect(component.totalFinal()).toBe(45000);

    component.setTipoPropina('personalizada');
    component.propinaPersonalizada.set(6000);
    expect(component.montoPropina()).toBe(6000);
    expect(component.totalFinal()).toBe(51000);
  });

  it('en efectivo no debe permitir cobrar si el dinero recibido es menor al total', () => {
    component.metodoPago.set('efectivo');
    component.efectivoRecibido.set(30000);
    expect(component.puedeCobrar()).toBe(false);

    component.efectivoRecibido.set(50000);
    expect(component.puedeCobrar()).toBe(true);
    expect(component.cambioVueltos()).toBe(500);
  });

  it('debe emitir resultado de cobro exitoso al confirmar', () => {
    component.metodoPago.set('tarjeta');
    component.confirmarCobro();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        cobrado: true,
        metodoPago: 'tarjeta',
        subtotal: 45000,
        total: 49500,
      })
    );
  });

  it('debe permitir pago mixto distribuyendo entre varios medios (ej: efectivo y transferencia)', () => {
    component.seleccionarMetodo('mixto');
    component.montoEfectivo.set(20000);
    component.montoTransferencia.set(20000);
    expect(component.asignacionCompleta()).toBe(false);
    expect(component.puedeCobrar()).toBe(false);

    component.completarMonto('tarjeta');
    expect(component.montoTarjeta()).toBe(9500);
    expect(component.asignacionCompleta()).toBe(true);

    component.efectivoRecibido.set(20000);
    expect(component.puedeCobrar()).toBe(true);

    component.confirmarCobro();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        cobrado: true,
        metodoPago: 'mixto',
        pagos: [
          { metodo: 'efectivo', monto: 20000 },
          { metodo: 'tarjeta', monto: 9500 },
          { metodo: 'transferencia', monto: 20000 },
        ],
      })
    );
  });

  it('cerrar sin cobrar debe emitir null para mantener la mesa y pedidos intactos', () => {
    component.cerrarSinCobrar();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
  });
});

describe('FacturaDialogComponent en Domicilio', () => {
  let component: FacturaDialogComponent;
  let fixture: ComponentFixture<FacturaDialogComponent>;
  let dialogRefSpy: { close: any };

  const mockPedidoDomicilio = {
    id_pedido: 201,
    numero_pedido: 55,
    tipo: 'domicilio',
    estado: 'enviada',
    etapaOperativa: 'En Reparto',
    metodo_pago: 'Transferencia',
    totalCalculado: 25000,
    items: [
      {
        id_item: 1,
        id_producto: 1,
        cantidad: 1,
        precio_unitario: 25000,
        subtotal: 25000,
        producto: { nombre: 'Pizza Especial' },
      },
    ],
  };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FacturaDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MAT_DIALOG_DATA, useValue: { pedido: mockPedidoDomicilio } },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FacturaDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe detectar que es domicilio e inicializar con el método fijado por el cliente', () => {
    expect(component.esDomicilio()).toBe(true);
    expect(component.metodoPago()).toBe('transferencia');
    expect(component.metodoPagoNombre()).toBe('Transferencia Electrónica');
  });

  it('no debe permitir cambiar el método de pago si es domicilio', () => {
    component.seleccionarMetodo('efectivo');
    expect(component.metodoPago()).toBe('transferencia');
  });

  it('debe cobrar directamente por transferencia sin requerir efectivo recibido', () => {
    expect(component.puedeCobrar()).toBe(true);
    component.confirmarCobro();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        cobrado: true,
        metodoPago: 'transferencia',
        total: 25000,
      })
    );
  });
});
