import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // M-03: Error handling explícito en la conexión a BD
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conexion a PostgreSQL establecida correctamente.');
    } catch (error) {
      this.logger.error('No se pudo conectar a la base de datos.', error);
      throw new Error(`Error de conexion a BD: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
