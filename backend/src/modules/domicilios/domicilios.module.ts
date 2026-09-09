import { Module } from '@nestjs/common';
import { DomiciliosController } from './domicilios.controller';
import { DomiciliosService } from './domicilios.service';

@Module({
  controllers: [DomiciliosController],
  providers: [DomiciliosService],
  exports: [DomiciliosService],
})
export class DomiciliosModule {}
