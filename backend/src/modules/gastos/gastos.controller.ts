import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GastosService } from './gastos.service';

/**
 * Controlador de Gastos
 * Módulo de egresos operativos. La gestión transaccional vinculada a turno de caja se expone en /api/v1/caja/gastos.
 */
@ApiTags('Gastos')
@ApiBearerAuth('JWT-auth')
@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}
}
