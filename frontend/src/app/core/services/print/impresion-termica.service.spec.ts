import { TestBed } from '@angular/core/testing';
import { ImpresionTermicaService } from './impresion-termica.service';

describe('ImpresionTermicaService', () => {
  let service: ImpresionTermicaService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImpresionTermicaService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('debe inicializarse con configuración por defecto para LUIGIE\'S en papel 80mm', () => {
    const cfg = service.config();
    expect(cfg.nombreComercio).toBe("LUIGIE'S");
    expect(cfg.anchoPapel).toBe('80mm');
    expect(cfg.piePagina).toContain('MesaLista');
    expect(cfg.imprimirClienteAlCobrar).toBe(true);
    expect(cfg.imprimirCocinaAlCobrar).toBe(false);
  });

  it('debe formatear pesos colombianos con separador de miles por punto', () => {
    expect(service.formatearPesos(21000)).toBe('$ 21.000');
    expect(service.formatearPesos(5000)).toBe('$ 5.000');
    expect(service.formatearPesos(1250500)).toBe('$ 1.250.500');
    expect(service.formatearPesos(0)).toBe('$ 0');
  });

  it('debe generar HTML térmico de factura cliente para domicilio con formato estilo ticket', () => {
    service.actualizarConfiguracion({
      direccionYNit: 'CRA 11 NO. 17AN - 98 POPAYAN NIT 1002972796',
    });

    const html = service.generarHtmlFacturaCliente({
      tipo: 'domicilio',
      numeroFactura: 45,
      numeroPedido: 12,
      cliente: {
        nombre: 'Peter Sanchez',
        telefono: '3187747206',
        direccion: 'Centro, Carrera 4 2-18',
        zona: 'Centro',
      },
      items: [
        {
          nombre: 'Cuchareable',
          cantidad: 1,
          precio_unitario: 15000,
          subtotal: 15000,
        },
      ],
      subtotal: 15000,
      costoEnvio: 5000,
      costoEmbalaje: 1000,
      total: 21000,
      formaPago: 'Efectivo',
    });

    expect(html).toContain('size: 80mm auto;');
    expect(html).toContain("LUIGIE&#39;S");
    expect(html).toContain('CRA 11 NO. 17AN - 98 POPAYAN NIT 1002972796');
    expect(html).toContain('Peter Sanchez');
    expect(html).toContain('57 3187747206');
    expect(html).toContain('X1 Cuchareable');
    expect(html).toContain('$ 15.000');
    expect(html).toContain('SUBTOTAL');
    expect(html).toContain('PRECIO DE ENTREGA');
    expect(html).toContain('$ 5.000');
    expect(html).toContain('PRECIO DE EMBALAJE');
    expect(html).toContain('$ 1.000');
    expect(html).toContain('TOTAL');
    expect(html).toContain('$ 21.000');
    expect(html).toContain('Este documento no tiene valor fiscal.');
    expect(html).toContain('MesaLista - Software gastronómico');
  });

  it('debe generar HTML térmico de factura cliente para mesa en salón con propina y vueltos', () => {
    service.actualizarConfiguracion({ anchoPapel: '58mm' });

    const html = service.generarHtmlFacturaCliente({
      tipo: 'salon',
      numeroFactura: 88,
      numeroMesa: 4,
      mesero: 'Carlos Mesero',
      items: [
        {
          nombre: 'Pizza Margarita',
          cantidad: 2,
          precio_unitario: 25000,
          subtotal: 50000,
          notas: ['Sin: Cebolla'],
        },
      ],
      subtotal: 50000,
      propina: 5000,
      total: 55000,
      formaPago: 'Efectivo',
      efectivoRecibido: 60000,
      cambio: 5000,
    });

    expect(html).toContain('size: 58mm auto;');
    expect(html).toContain('MESA #4');
    expect(html).toContain('ATENDIDO POR: Carlos Mesero');
    expect(html).toContain('FAC-#88');
    expect(html).toContain('X2 Pizza Margarita');
    expect(html).toContain('SIN: Cebolla');
    expect(html).toContain('PROPINA VOLUNTARIA');
    expect(html).toContain('$ 55.000');
    expect(html).toContain('RECIBIDO: $ 60.000');
    expect(html).toContain('CAMBIO: $ 5.000');
  });

  it('debe generar comanda de cocina sin precios destacando cantidades, SIN ingredientes y notas', () => {
    const html = service.generarHtmlComandaCocina({
      tipo: 'salon',
      numeroMesa: 3,
      numeroPedido: 19,
      mesero: 'Ana Mesera',
      items: [
        {
          nombre: 'Hamburguesa Especial',
          cantidad: 2,
          precio_unitario: 22000,
          subtotal: 44000,
          ingredientes_removidos: ['Cebolla', 'Tomate'],
          observacion: 'Término medio',
        },
        {
          nombre: 'Jugo Natural',
          cantidad: 1,
          precio_unitario: 7000,
          subtotal: 7000,
        },
      ],
      observacionGeneral: 'Servir todo junto',
    });

    expect(html).toContain('*** COMANDA COCINA ***');
    expect(html).toContain('MESA #3');
    expect(html).toContain('COMANDA #19');
    expect(html).toContain('X2 Hamburguesa Especial');
    expect(html).toContain('** SIN: Cebolla, Tomate **');
    expect(html).toContain('* NOTA: Término medio');
    expect(html).toContain('NOTA GENERAL: Servir todo junto');
    expect(html).toContain('TOTAL ÍTEMS: 3 UNIDADES');
    expect(html).not.toContain('$ 44.000');
    expect(html).not.toContain('$ 22.000');
  });

  it('debe escapar caracteres HTML peligrosos contra XSS en los tickets', () => {
    const html = service.generarHtmlFacturaCliente({
      tipo: 'domicilio',
      cliente: {
        nombre: '<script>alert(1)</script>',
        direccion: 'Calle "5" <img onerror=x>',
      },
      items: [{ nombre: '<b>Burger</b>', cantidad: 1, subtotal: 10000 }],
      subtotal: 10000,
      total: 10000,
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Burger&lt;/b&gt;');
  });

  it('debe persistir los cambios de configuración térmica en localStorage', () => {
    service.actualizarConfiguracion({
      anchoPapel: '58mm',
      direccionYNit: 'CRA 9 # 10-20 POPAYAN NIT 900123456',
      imprimirCocinaAlCobrar: true,
    });

    const guardado = JSON.parse(localStorage.getItem('mesalista_config_impresion_termica_v1') || '{}');
    expect(guardado.anchoPapel).toBe('58mm');
    expect(guardado.direccionYNit).toBe('CRA 9 # 10-20 POPAYAN NIT 900123456');
    expect(guardado.imprimirCocinaAlCobrar).toBe(true);
  });

  it('imprimirLote debe combinar factura cliente y comanda de cocina con salto de página en un solo trabajo', () => {
    const spyEnviar = vi
      .spyOn(service as unknown as { enviarAImpresora: (html: string) => void }, 'enviarAImpresora')
      .mockImplementation(() => {});

    service.imprimirLote({
      cliente: {
        tipo: 'salon',
        numeroFactura: 50,
        numeroMesa: 2,
        items: [{ nombre: 'Salchipapa', cantidad: 1, subtotal: 18000 }],
        subtotal: 18000,
        total: 18000,
      },
      cocina: {
        tipo: 'salon',
        numeroMesa: 2,
        numeroPedido: 7,
        items: [{ nombre: 'Salchipapa', cantidad: 1 }],
      },
    });

    expect(spyEnviar).toHaveBeenCalledTimes(1);
    const html = spyEnviar.mock.calls[0][0];
    expect(html).toContain('ticket-page-break');
    expect(html).toContain('FAC-#50');
    expect(html).toContain('*** COMANDA COCINA ***');
  });
});
