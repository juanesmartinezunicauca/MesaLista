import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MesasService } from './mesas.service';

describe('MesasService (Dominio: Mesas y Pedidos)', () => {
  let service: MesasService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(MesasService);

    // Configurar datos para pruebas de dominio
    service.catalogoProductos.set([
      {
        id_producto: 1,
        nombre: 'Hamburguesa Clásica',
        categoria: 'Hamburguesas',
        precio_venta: 18000,
        disponible: true,
        ingredientes_removibles: ['Cebolla', 'Tomate'],
      },
      {
        id_producto: 2,
        nombre: 'Cerveza Club Colombia Dorada',
        categoria: 'Bebidas',
        precio_venta: 7000,
        disponible: true,
        ingredientes_removibles: [],
      },
    ]);

    // Configurar mesas base para las pruebas
    service.crearMesa(1);
    service.crearMesa(2);
    service.crearMesa(4);
    service.crearMesa(6);
  });

  it('debe inicializarse con métricas calculadas y responder al registrar mesas', () => {
    const metricas = service.metricas();
    expect(metricas.total).toBe(4);
    expect(metricas.libres).toBe(4);
    expect(metricas.ocupadas).toBe(0);
    expect(metricas.enPedido).toBe(0);
  });

  it('debe registrar una nueva mesa y rechazar números duplicados', () => {
    const resExitosa = service.crearMesa(99);
    expect(resExitosa.exito).toBe(true);

    const resDuplicada = service.crearMesa(99);
    expect(resDuplicada.exito).toBe(false);
    expect(resDuplicada.mensaje).toContain('ya se encuentra registrada');
  });

  it('debe cambiar de estado a en_pedido al agregar un producto al borrador', () => {
    const mesa1 = service.mesas().find((m) => m.numero === 1)!;
    expect(mesa1.estado_visual).toBe('libre');

    const producto = service.catalogoProductos()[0];
    service.agregarItemBorrador(mesa1.id_mesa, producto);

    const mesaActualizada = service.mesas().find((m) => m.numero === 1)!;
    expect(mesaActualizada.estado_visual).toBe('en_pedido');
    expect(mesaActualizada.borrador_local.length).toBe(1);
  });

  it('debe pasar a ocupada al enviar el pedido a cocina', () => {
    const mesa4 = service.mesas().find((m) => m.numero === 4)!;
    const producto = service.catalogoProductos()[0];

    service.agregarItemBorrador(mesa4.id_mesa, producto);
    const res = service.enviarPedidoACocina(mesa4.id_mesa, 'Mesa VIP');

    expect(res.exito).toBe(true);
    const mesaActualizada = service.mesas().find((m) => m.numero === 4)!;
    expect(mesaActualizada.estado_visual).toBe('ocupada');
    expect(mesaActualizada.pedidos.length).toBe(1);
    expect(mesaActualizada.borrador_local.length).toBe(0);
  });

  it('debe transferir los pedidos a la mesa destino y liberar la mesa origen', () => {
    // Preparar mesa 2 con un pedido
    const mesa2 = service.mesas().find((m) => m.numero === 2)!;
    const producto = service.catalogoProductos()[0];
    service.agregarItemBorrador(mesa2.id_mesa, producto);
    service.enviarPedidoACocina(mesa2.id_mesa);

    // Mesa 6 está libre
    const mesa6 = service.mesas().find((m) => m.numero === 6)!;

    const res = service.transferirMesa(mesa2.id_mesa, mesa6.id_mesa);
    expect(res.exito).toBe(true);

    const mesa2Despues = service.mesas().find((m) => m.numero === 2)!;
    const mesa6Despues = service.mesas().find((m) => m.numero === 6)!;

    expect(mesa2Despues.estado_visual).toBe('libre');
    expect(mesa2Despues.pedidos.length).toBe(0);

    expect(mesa6Despues.estado_visual).toBe('ocupada');
    expect(mesa6Despues.pedidos.length).toBeGreaterThan(0);
  });
});
