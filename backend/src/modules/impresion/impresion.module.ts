import { Module } from '@nestjs/common';
import { ImpresionService } from './impresion.service';

@Module({
  providers: [ImpresionService],
  exports: [ImpresionService],
})
export class ImpresionModule {}
