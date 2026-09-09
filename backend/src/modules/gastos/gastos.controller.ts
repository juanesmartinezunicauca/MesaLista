import { Controller } from '@nestjs/common';
import { GastosService } from './gastos.service';

@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}
}
