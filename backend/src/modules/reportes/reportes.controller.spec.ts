import { Test, TestingModule } from '@nestjs/testing';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

describe('ReportesController', () => {
  let controller: ReportesController;
  let service: {
    obtenerDashboard: jest.Mock;
    obtenerReporteVentas: jest.Mock;
    obtenerReporteCajaMedios: jest.Mock;
    obtenerReporteInventario: jest.Mock;
    obtenerReporteGastos: jest.Mock;
    obtenerReporteRentabilidad: jest.Mock;
    obtenerReporteOperacion: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      obtenerDashboard: jest.fn(),
      obtenerReporteVentas: jest.fn(),
      obtenerReporteCajaMedios: jest.fn(),
      obtenerReporteInventario: jest.fn(),
      obtenerReporteGastos: jest.fn(),
      obtenerReporteRentabilidad: jest.fn(),
      obtenerReporteOperacion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportesController],
      providers: [
        {
          provide: ReportesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ReportesController>(ReportesController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('GET /reportes/dashboard debe delegar a service.obtenerDashboard', async () => {
    const filtro = { fecha_inicio: '2026-10-01', fecha_fin: '2026-10-15' };
    const mockRes = { kpis: { total_ventas: 500000 } };
    service.obtenerDashboard.mockResolvedValue(mockRes);

    const res = await controller.obtenerDashboard(filtro);
    expect(service.obtenerDashboard).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/ventas debe delegar a service.obtenerReporteVentas', async () => {
    const filtro = { fecha_inicio: '2026-10-01', fecha_fin: '2026-10-15' };
    const mockRes = { resumen: { total_ventas: 1200000 } };
    service.obtenerReporteVentas.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteVentas(filtro);
    expect(service.obtenerReporteVentas).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/caja-medios debe delegar a service.obtenerReporteCajaMedios', async () => {
    const filtro = {};
    const mockRes = { resumen: { total_recaudo: 800000 } };
    service.obtenerReporteCajaMedios.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteCajaMedios(filtro);
    expect(service.obtenerReporteCajaMedios).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/inventario debe delegar a service.obtenerReporteInventario', async () => {
    const filtro = { solo_bajo_stock: true };
    const mockRes = { resumen: { total_bajo_stock: 3 } };
    service.obtenerReporteInventario.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteInventario(filtro);
    expect(service.obtenerReporteInventario).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/gastos debe delegar a service.obtenerReporteGastos', async () => {
    const filtro = { tipo_gasto: 'Insumos' };
    const mockRes = { resumen: { total_gastos: 150000 } };
    service.obtenerReporteGastos.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteGastos(filtro);
    expect(service.obtenerReporteGastos).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/rentabilidad debe delegar a service.obtenerReporteRentabilidad', async () => {
    const filtro = { fecha_inicio: '2026-10-01' };
    const mockRes = { resumen: { utilidad_bruta_total: 450000 } };
    service.obtenerReporteRentabilidad.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteRentabilidad(filtro);
    expect(service.obtenerReporteRentabilidad).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });

  it('GET /reportes/operacion debe delegar a service.obtenerReporteOperacion', async () => {
    const filtro = {};
    const mockRes = { resumen: { total_pedidos: 45 } };
    service.obtenerReporteOperacion.mockResolvedValue(mockRes);

    const res = await controller.obtenerReporteOperacion(filtro);
    expect(service.obtenerReporteOperacion).toHaveBeenCalledWith(filtro);
    expect(res).toEqual(mockRes);
  });
});
