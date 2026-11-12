import { Test, TestingModule } from '@nestjs/testing';
import { FacturacionController } from './facturacion.controller';
import { FacturacionService } from './facturacion.service';
import { AnularFacturaDto, CreateFacturaDto, UpdateFacturaDto } from './dto';

describe('FacturacionController (Unit Tests)', () => {
  let controller: FacturacionController;
  let service: jest.Mocked<FacturacionService>;

  const mockFacturacionService = {
    crearFactura: jest.fn(),
    obtenerTodas: jest.fn(),
    obtenerPorId: jest.fn(),
    actualizarFactura: jest.fn(),
    anularFactura: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacturacionController],
      providers: [
        {
          provide: FacturacionService,
          useValue: mockFacturacionService,
        },
      ],
    }).compile();

    controller = module.get<FacturacionController>(FacturacionController);
    service = module.get(FacturacionService);
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('crear', () => {
    it('debe invocar facturacionService.crearFactura con el DTO y el id del usuario', async () => {
      const dto: CreateFacturaDto = {
        id_pedido: 1,
        metodo_pago: 'efectivo',
        monto_recibido: 50000,
        incluye_propina: true,
        porcentaje_propina: 10,
      };
      const mockResult = { id_factura: 1, total: 45000 };
      mockFacturacionService.crearFactura.mockResolvedValue(mockResult as any);

      const result = await controller.crear(dto, 2);

      expect(service.crearFactura).toHaveBeenCalledWith(dto, 2);
      expect(result).toEqual(mockResult);
    });
  });

  describe('obtenerTodas', () => {
    it('debe invocar facturacionService.obtenerTodas con los filtros recibidos', async () => {
      const mockResult = [{ id_factura: 1 }, { id_factura: 2 }];
      mockFacturacionService.obtenerTodas.mockResolvedValue(mockResult as any);

      const result = await controller.obtenerTodas('salon', '2026-11-12', 'Juan', 5);

      expect(service.obtenerTodas).toHaveBeenCalledWith({
        tipo: 'salon',
        fecha: '2026-11-12',
        buscar: 'Juan',
        id_caja: 5,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('obtenerPorId', () => {
    it('debe invocar facturacionService.obtenerPorId con el ID', async () => {
      const mockResult = { id_factura: 10, total: 80000 };
      mockFacturacionService.obtenerPorId.mockResolvedValue(mockResult as any);

      const result = await controller.obtenerPorId(10);

      expect(service.obtenerPorId).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('actualizar', () => {
    it('debe invocar facturacionService.actualizarFactura con id, dto y usuario autenticado', async () => {
      const dto: UpdateFacturaDto = { observaciones: 'Ajuste de propina' };
      const authUser = { id_usuario: 1, rol: 'administrador' };
      const mockResult = { id_factura: 10, observaciones: 'Ajuste de propina' };
      mockFacturacionService.actualizarFactura.mockResolvedValue(mockResult as any);

      const result = await controller.actualizar(10, dto, authUser);

      expect(service.actualizarFactura).toHaveBeenCalledWith(10, dto, authUser);
      expect(result).toEqual(mockResult);
    });
  });

  describe('anular', () => {
    it('debe invocar facturacionService.anularFactura con id, motivo y usuario', async () => {
      const dto: AnularFacturaDto = { motivo: 'Cobro duplicado por error de datáfono' };
      const mockResult = { id_factura: 10, estado: 'anulada' };
      mockFacturacionService.anularFactura.mockResolvedValue(mockResult as any);

      const result = await controller.anular(10, dto, 1);

      expect(service.anularFactura).toHaveBeenCalledWith(10, dto.motivo, 1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('eliminar', () => {
    it('debe invocar facturacionService.anularFactura con motivo por defecto', async () => {
      const mockResult = { id_factura: 10, estado: 'anulada' };
      mockFacturacionService.anularFactura.mockResolvedValue(mockResult as any);

      const result = await controller.eliminar(10, 1);

      expect(service.anularFactura).toHaveBeenCalledWith(
        10,
        'Anulación solicitada por terminal de cobro',
        1,
      );
      expect(result).toEqual(mockResult);
    });
  });
});

