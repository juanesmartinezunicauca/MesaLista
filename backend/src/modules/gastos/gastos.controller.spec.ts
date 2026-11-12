import { Test, TestingModule } from '@nestjs/testing';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';

describe('GastosController (Unit Tests)', () => {
  let controller: GastosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GastosController],
      providers: [GastosService],
    }).compile();

    controller = module.get<GastosController>(GastosController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });
});
