import { Controller } from '@nestjs/common';
import { DomiciliosService } from './domicilios.service';

@Controller('domicilios')
export class DomiciliosController {
  constructor(private readonly domiciliosService: DomiciliosService) {}
}
