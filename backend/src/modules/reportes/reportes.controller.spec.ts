import { Test, TestingModule } from '@nestjs/testing';
import { PeriodoReporte } from './dto';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

describe('ReportesController', () => {
  let controller: ReportesController;
  let service: any;

  beforeEach(async () => {
    service = {
      obtenerResumenEjecutivo: jest.fn(),
      obtenerHistorialTurnosCaja: jest.fn(),
      exportarReporteCsv: jest.fn(),
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

  describe('obtenerResumen', () => {
    it('debe delegar la consulta al servicio', async () => {
      const mockResult = { kpis: { ingresos_totales: 100000 } };
      service.obtenerResumenEjecutivo.mockResolvedValue(mockResult);

      const res = await controller.obtenerResumen({ periodo: PeriodoReporte.HOY });
      expect(service.obtenerResumenEjecutivo).toHaveBeenCalledWith({
        periodo: PeriodoReporte.HOY,
      });
      expect(res).toBe(mockResult);
    });
  });

  describe('obtenerHistorialTurnos', () => {
    it('debe delegar la consulta con el limite convertido a número', async () => {
      service.obtenerHistorialTurnosCaja.mockResolvedValue([]);

      await controller.obtenerHistorialTurnos('20');
      expect(service.obtenerHistorialTurnosCaja).toHaveBeenCalledWith(20);
    });
  });

  describe('exportarCsv', () => {
    it('debe enviar el archivo CSV configurando cabeceras de descarga', async () => {
      service.exportarReporteCsv.mockResolvedValue('CSV_DATA');
      const mockRes: any = {
        setHeader: jest.fn(),
      };

      const result = await controller.exportarCsv(
        { periodo: PeriodoReporte.HOY },
        mockRes,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename='),
      );
      expect(result).toBe('CSV_DATA');
    });
  });
});
