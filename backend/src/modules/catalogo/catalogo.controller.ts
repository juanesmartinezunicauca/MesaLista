import { Controller } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}
}
