import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // A-05: CORS restringido al origen de la LAN del restaurante
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Prefijo global de API — todos los endpoints quedan bajo /api/v1/...
  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
