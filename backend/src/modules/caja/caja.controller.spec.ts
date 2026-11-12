import { Test, TestingModule } from '@nestjs/testing';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { AbrirCajaDto, ActualizarBaseDto, CerrarCajaDto, CreateGastoDto, UpdateGastoDto } from './dto';

describe('CajaController (Unit Tests)', () => {
  let controller: CajaController;
  let service: jest.Mocked<CajaService>;

  const mockCajaService = {
    abrirCaja: jest.fn(),
    actualizarBaseCaja: jest.fn(),
    obtenerEstadoActual: jest.fn(),
    registrarGasto: jest.fn(),
    obtenerGastos: jest.fn(),
    actualizarGasto: jest.fn(),
    eliminarGasto: jest.fn(),
    cerrarCaja: jest.fn(),
    obtenerHistorial: jest.fn(),
    actualizarObservacionTurno: jest.fn(),
    resetOperacional: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CajaController],
      providers: [
        {
          provide: CajaService,
          useValue: mockCajaService,
        },
      ],
    }).compile();

    controller = module.get<CajaController>(CajaController);
    service = module.get(CajaService);
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('abrir', () => {
    it('debe invocar cajaService.abrirCaja con el DTO y el id del usuario', async () => {
      const dto: AbrirCajaDto = { monto_apertura: 100000 };
      const mockResult = { id_caja: 1, monto_apertura: 100000, estado: 'abierta' };
      mockCajaService.abrirCaja.mockResolvedValue(mockResult as any);

      const result = await controller.abrir(dto, 1);

      expect(service.abrirCaja).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('actualizarBase', () => {
    it('debe invocar cajaService.actualizarBaseCaja con el nuevo valor inicial', async () => {
      const dto: ActualizarBaseDto = { valor_inicial: 150000 };
      const mockResult = { id_caja: 1, monto_apertura: 150000 };
      mockCajaService.actualizarBaseCaja.mockResolvedValue(mockResult as any);

      const result = await controller.actualizarBase(dto);

      expect(service.actualizarBaseCaja).toHaveBeenCalledWith(150000);
      expect(result).toEqual(mockResult);
    });
  });

  describe('obtenerEstado', () => {
    it('debe retornar el estado operativo actual de la caja', async () => {
      const mockResult = { cajaAbierta: true, caja: { id_caja: 1, estado: 'abierta' } };
      mockCajaService.obtenerEstadoActual.mockResolvedValue(mockResult as any);

      const result = await controller.obtenerEstado();

      expect(service.obtenerEstadoActual).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('registrarGasto', () => {
    it('debe invocar cajaService.registrarGasto con el DTO y el id del usuario', async () => {
      const dto: CreateGastoDto = { monto: 20000, concepto: 'Compra de hielo', categoria: 'Insumos' };
      const mockResult = { id_gasto: 1, monto: 20000, concepto: 'Compra de hielo' };
      mockCajaService.registrarGasto.mockResolvedValue(mockResult as any);

      const result = await controller.registrarGasto(dto, 1);

      expect(service.registrarGasto).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('obtenerGastos', () => {
    it('debe invocar cajaService.obtenerGastos con el límite por defecto o especificado', async () => {
      const mockResult = [{ id_gasto: 1, monto: 20000 }];
      mockCajaService.obtenerGastos.mockResolvedValue(mockResult as any);

      const result = await controller.obtenerGastos('25');

      expect(service.obtenerGastos).toHaveBeenCalledWith(25);
      expect(result).toEqual(mockResult);
    });
  });

  describe('actualizarGasto', () => {
    it('debe invocar cajaService.actualizarGasto con id, dto y usuario autenticado', async () => {
      const dto: UpdateGastoDto = { monto: 25000 };
      const mockResult = { id_gasto: 3, monto: 25000 };
      const authUser = { id_usuario: 1, rol: 'administrador' };
      mockCajaService.actualizarGasto.mockResolvedValue(mockResult as any);

      const result = await controller.actualizarGasto(3, dto, authUser);

      expect(service.actualizarGasto).toHaveBeenCalledWith(3, dto, authUser);
      expect(result).toEqual(mockResult);
    });
  });

  describe('eliminarGasto', () => {
    it('debe invocar cajaService.eliminarGasto con el ID', async () => {
      const mockResult = { message: 'Gasto eliminado' };
      mockCajaService.eliminarGasto.mockResolvedValue(mockResult as any);

      const result = await controller.eliminarGasto(3);

      expect(service.eliminarGasto).toHaveBeenCalledWith(3);
      expect(result).toEqual(mockResult);
    });
  });

  describe('cerrar', () => {
    it('debe invocar cajaService.cerrarCaja con el DTO y el id de usuario', async () => {
      const dto: CerrarCajaDto = { monto_cierre_real: 250000, observaciones: 'Sin novedades' };
      const mockResult = { id_caja: 1, estado: 'cerrada', monto_cierre: 250000 };
      mockCajaService.cerrarCaja.mockResolvedValue(mockResult as any);

      const result = await controller.cerrar(dto, 2);

      expect(service.cerrarCaja).toHaveBeenCalledWith(dto, 2);
      expect(result).toEqual(mockResult);
    });
  });

  describe('obtenerHistorial', () => {
    it('debe invocar cajaService.obtenerHistorial con el límite especificado', async () => {
      const mockResult = [{ id_caja: 1 }, { id_caja: 2 }];
      mockCajaService.obtenerHistorial.mockResolvedValue(mockResult as any);

      const result = await controller.obtenerHistorial('10');

      expect(service.obtenerHistorial).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('actualizarObservacion', () => {
    it('debe invocar cajaService.actualizarObservacionTurno', async () => {
      const mockResult = { id_caja: 1, observaciones: 'Nota de auditoría' };
      mockCajaService.actualizarObservacionTurno.mockResolvedValue(mockResult as any);

      const result = await controller.actualizarObservacion(1, 'Nota de auditoría');

      expect(service.actualizarObservacionTurno).toHaveBeenCalledWith(1, 'Nota de auditoría');
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetOperacional', () => {
    it('debe invocar cajaService.resetOperacional', async () => {
      const mockResult = { message: 'Operación reiniciada exitosamente' };
      mockCajaService.resetOperacional.mockResolvedValue(mockResult as any);

      const result = await controller.resetOperacional();

      expect(service.resetOperacional).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });
});
