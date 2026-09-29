import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardDomisComponent } from './dashboard-domis';
import { DomiciliosApiService } from '../../../core/services/api/domicilios-api.service';
import { FacturacionApiService } from '../../../core/services/api/facturacion-api.service';
import { of } from 'rxjs';
import { Domicilio } from '../../../core/models';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('DashboardDomisComponent', () => {
  let component: DashboardDomisComponent;
  let fixture: ComponentFixture<DashboardDomisComponent>;

  const mockDomicilios: Domicilio[] = [
    {
      id_pedido: 1,
      numero_pedido: 101,
      tipo: 'domicilio',
      estado: 'enviada',
      etapaOperativa: 'En Preparación',
      totalCalculado: 35000,
      fecha_hora: '2026-09-28T20:00:00Z',
      id_cliente: 1,
      id_usuario: 1,
      cliente: {
        id_cliente: 1,
        nombre: 'Carlos Gómez',
        telefono: '3112223344',
        direccion: 'Calle 5N # 12-45',
      },
      items: [
        {
          id_producto: 1,
          cantidad: 2,
          precio_unitario: 17500,
          producto: {
            id_producto: 1,
            nombre: 'Hamburguesa Doble',
            categoria: 'Hamburguesas',
            precio_venta: 17500,
            disponible: true,
          },
        },
      ],
    },
    {
      id_pedido: 2,
      numero_pedido: 102,
      tipo: 'domicilio',
      estado: 'enviada',
      etapaOperativa: 'En Reparto',
      totalCalculado: 20000,
      fecha_hora: '2026-09-28T20:15:00Z',
      id_cliente: 2,
      id_usuario: 1,
      cliente: {
        id_cliente: 2,
        nombre: 'María Rodríguez',
        telefono: '3159998877',
        direccion: 'Carrera 9 # 3-21',
      },
      items: [],
    },
    {
      id_pedido: 3,
      numero_pedido: 103,
      tipo: 'domicilio',
      estado: 'cerrada',
      etapaOperativa: 'Entregado',
      totalCalculado: 45000,
      fecha_hora: '2026-09-28T19:30:00Z',
      id_cliente: 3,
      id_usuario: 1,
      cliente: {
        id_cliente: 3,
        nombre: 'Esteban Quintero',
        telefono: '3201112233',
        direccion: 'Avenida Panamericana',
      },
      items: [],
    },
  ];

  let fakeDomiciliosApi: {
    obtenerTodos: () => any;
    cambiarEstado: (id: number, estado: string) => any;
    cancelar: (id: number, motivo?: string) => any;
  };

  let fakeFacturacionApi: {
    crearFactura: (payload: any) => any;
  };

  beforeEach(async () => {
    fakeDomiciliosApi = {
      obtenerTodos: vi.fn().mockReturnValue(of(mockDomicilios)),
      cambiarEstado: vi.fn().mockReturnValue(
        of({ ...mockDomicilios[0], etapaOperativa: 'En Reparto' }),
      ),
      cancelar: vi.fn().mockReturnValue(
        of({ ...mockDomicilios[0], etapaOperativa: 'Cancelado' }),
      ),
    };

    fakeFacturacionApi = {
      crearFactura: vi.fn().mockReturnValue(of({ id_venta: 1 })),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardDomisComponent],
      providers: [
        { provide: DomiciliosApiService, useValue: fakeDomiciliosApi },
        { provide: FacturacionApiService, useValue: fakeFacturacionApi },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn().mockReturnValue({ afterClosed: () => of(null) }),
          },
        },
        {
          provide: MatSnackBar,
          useValue: { open: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardDomisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y cargar domicilios en el inicio', () => {
    expect(component).toBeTruthy();
    expect(component.pedidos().length).toBe(3);
  });

  it('debe calcular KPIs correctamente', () => {
    const kpis = component.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.enPreparacion).toBe(1);
    expect(kpis.enReparto).toBe(1);
    expect(kpis.entregados).toBe(1);
  });

  it('debe filtrar pedidos por estado', () => {
    component.filtroEstado.set('En Reparto');
    const filtrados = component.pedidosFiltrados();
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].numero_pedido).toBe(102);
  });

  it('debe filtrar pedidos por texto de búsqueda en nombre, teléfono o dirección', () => {
    component.busqueda.set('María');
    expect(component.pedidosFiltrados().length).toBe(1);

    component.busqueda.set('311222');
    expect(component.pedidosFiltrados().length).toBe(1);

    component.busqueda.set('#103');
    expect(component.pedidosFiltrados().length).toBe(1);
  });

  it('debe despachar un pedido llamando a domiciliosApi.cambiarEstado', () => {
    component.despachar(mockDomicilios[0]);
    expect(fakeDomiciliosApi.cambiarEstado).toHaveBeenCalledWith(1, 'En Reparto');
  });

  it('debe cobrar y facturar un pedido llamando a facturacionApi.crearFactura', () => {
    component.cobrarYEntregar(mockDomicilios[1], 'Efectivo');
    expect(fakeFacturacionApi.crearFactura).toHaveBeenCalledWith(
      expect.objectContaining({
        id_pedido: 2,
        pagos: [{ medio_pago: 'Efectivo', monto: 20000 }],
      }),
    );
  });
});
