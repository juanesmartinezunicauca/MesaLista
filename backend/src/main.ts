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
      'Documentación técnica interactiva de la API REST de **MesaLista POS** (Restaurante Luigie\'s).\n\n' +
      'Estándar OpenAPI 3.0 para comandería, plano interactivo de mesas, cocina (KDS), portal de domicilios, facturación y arqueo de caja.\n\n' +
      '### Autenticación Bearer (JWT) + Google OAuth 2.0:\n' +
      'El sistema opera exclusivamente mediante federación **Google Identity Services** (sin contraseñas locales). ' +
      'Para probar rutas protegidas, autentícate en `POST /api/v1/auth/google` enviando un `idToken` válido de Google, ' +
      'copia el `accessToken` retornado y presiona el botón **Authorize** arriba a la derecha.\n\n' +
      '### Control de Acceso Basado en Roles (RBAC):\n' +
      '- **administrador:** Control total del sistema (usuarios, catálogo, inventario, anulaciones, reportes BI y configuración).\n' +
      '- **cajero:** Apertura/cierre de caja, gastos menores, facturación, cobros, pedidos, mesas y gestión de domicilios.\n' +
      '- **mesero:** Atención de salón, toma de comandas, transferencia de mesas, consulta de carta y seguimiento de entregas.\n' +
      '- **cocina:** Visualización de cola de preparación (KDS) y cambio de estado de comandas en cocina.\n' +
      '- **cliente:** Portal público de domicilios (creación y consulta restringida de sus propios pedidos).\n' +
      '- **Público (`@Public`):** Carta gastronómica (`GET /catalogo/productos`, `GET /catalogo/categorias`) y disponibilidad de domicilios (`GET /domicilios/estado-servicio`).',
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
    .addTag(
      'Autenticación',
      'Módulo de identidad y sesión. Valida criptográficamente el ID Token de Google OAuth 2.0 (JWKS), vincula colaboradores pre-autorizados mediante código de invitación (INV-XXXXXX) o registra clientes automáticamente, emite el JWT Bearer de MesaLista y permite consultar/editar el perfil propio.',
    )
    .addTag(
      'Usuarios',
      'Módulo administrativo de talento humano y control de acceso (exclusivo rol administrador). Permite registrar colaboradores, generar/reenviar códigos efímeros de invitación con vigencia de 48 h sin persistir correos personales en BD, actualizar roles o estados y aplicar borrado lógico o físico según historial.',
    )
    .addTag(
      'Mesas',
      'Módulo operativo del plano de salón (roles administrador, cajero y mesero; creación/edición/eliminación solo administrador). Gestiona el mapa en tiempo real de mesas (libre/ocupada), sus comandas activas asociadas y la transferencia atómica de cuentas entre mesas.',
    )
    .addTag(
      'Catálogo',
      'Módulo de carta gastronómica e inventario. Expone productos y categorías públicamente para comandería y portal cliente; restringe al administrador la creación/edición de platos, registro trazable de entradas/mermas/arqueos de stock y consulta de bitácoras de inventario.',
    )
    .addTag(
      'Pedidos',
      'Módulo de comandería de salón y pantalla de cocina KDS (administrador, cajero, mesero y cocina según operación). Gestiona creación de comandas con congelamiento histórico de precios y descuento de inventario, consulta de cola activa por mesa o estado, avance de preparación y cancelaciones.',
    )
    .addTag(
      'Domicilios',
      'Módulo de pedidos con entrega a domicilio y portal cliente. Incluye disponibilidad pública del servicio, directorio operativo de repartidores, creación de pedidos para clientes autenticados o terminal POS, control anti-IDOR en consultas de cliente y seguimiento de estados de despacho.',
    )
    .addTag(
      'Facturación',
      'Módulo de cobro, emisión de comprobantes y conciliación de pagos (administrador, cajero y mesero en cobro; anulaciones por administrador/cajero). Exige turno de caja abierto, soporta múltiples medios de pago y propina, libera automáticamente la mesa en salón y permite anulación auditada.',
    )
    .addTag(
      'Caja',
      'Módulo contable de turnos de caja, arqueo físico y egresos menores (administrador y cajero; auditoría/reset exclusivo administrador). Controla apertura con base inicial, balance teórico en vivo, registro/gestión de gastos de caja (/caja/gastos), cierre ciego con cálculo de sobrante/faltante e historial.',
    )
    .addTag(
      'Gastos',
      'Módulo de dominio para egresos operativos. Nota: la API REST operativa para registrar, listar, actualizar y eliminar gastos menores vinculados al turno de caja activo se expone bajo /api/v1/caja/gastos en la etiqueta Caja.',
    )
    .addTag(
      'Reportes',
      'Módulo de Business Intelligence (BI) exclusivo para el rol administrador. Consolida KPIs ejecutivos, desglose de ventas por canal/producto, conciliación de caja por medios de pago, valorización/alertas de inventario, egresos, rentabilidad bruta y rendimiento operativo por horas pico.',
    )
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
void bootstrap().catch((err: unknown) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
