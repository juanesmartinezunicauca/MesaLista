import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { PrismaExceptionFilter } from './common/filters';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // OWASP A05: Protección de cabeceras HTTP de seguridad con Helmet
  // Configuración de CSP compatible con Swagger UI en /api/docs
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
        },
      },
    }),
  );

  // Límite controlado de payload para permitir imágenes en base64 evitando saturación por DoS
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  // Blindaje contra inyección de bytes nulos (CWE-158 / Null Byte Poisoning)
  app.use((req: any, res: any, next: any) => {
    if (req.query) {
      for (const [key, val] of Object.entries(req.query)) {
        if (typeof val === 'string' && val.includes('\0')) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'BadRequest',
            message: `El parámetro '${key}' contiene caracteres nulos o secuencias no permitidas.`,
          });
        }
      }
    }
    next();
  });

  // OWASP A05: CORS restringido para entornos autorizados (desarrollo local, LAN y dominios en Vercel)
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);

      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app') ||
        configuredOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error('Acceso no permitido por política CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Prefijo global de API — todos los endpoints quedan bajo /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Validación global de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtro global de excepciones de base de datos Prisma
  app.useGlobalFilters(new PrismaExceptionFilter());

  // =========================================================================
  // Configuración OpenAPI Specification 3.0 / Swagger UI interactivo
  // Disponible en: http://localhost:3000/api/docs
  // =========================================================================
  const config = new DocumentBuilder()
    .setTitle('MesaLista POS API')
    .setDescription(
      'Documentación técnica interactiva de la API REST de MesaLista POS (Restaurante Luigie\'s).\n\n' +
      'Estándar OpenAPI 3.0 para comandería, mesas interactivas, KDS, domicilios, facturación y arqueo de caja.\n\n' +
      '### Autenticación Bearer (JWT):\n' +
      'Para probar rutas protegidas, inicia sesión en `/api/v1/auth/google` o `/api/v1/auth/login`, ' +
      'copia el `accessToken` y presiona el botón **Authorize** arriba a la derecha ingresando el token Bearer.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingresa el token JWT emitido por MesaLista POS (sin prefijo Bearer)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Autenticación', 'Endpoints de federación Google OAuth 2.0, login y gestión de sesión')
    .addTag('Usuarios', 'Gestión de colaboradores, roles RBAC y tokens de enrolamiento efímeros')
    .addTag('Mesas', 'Control operativo de salón, comandería interactiva y liberación de mesas')
    .addTag('Catálogo', 'Gestión de productos, categorías, inventario y ajustes de merma')
    .addTag('Pedidos', 'Gestión de comandas para salón y cola KDS de cocina')
    .addTag('Domicilios', 'Gestión integral de pedidos con entrega a domicilio y recepción cliente')
    .addTag('Facturación', 'Cobro, cálculo de propina, registro de pagos y anulación formal')
    .addTag('Caja', 'Apertura de turno, control de gastos menores, arqueo físico y cierre contable')
    .addTag('Reportes', 'Métricas analíticas operativas y financieras ejecutivas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MesaLista POS — Swagger Documentation (OpenAPI 3.0)',
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      displayRequestDuration: true,
      docExpansion: 'none',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
