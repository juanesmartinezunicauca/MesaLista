import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { MesasModule } from './modules/mesas/mesas.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { DomiciliosModule } from './modules/domicilios/domicilios.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { CajaModule } from './modules/caja/caja.module';
import { GastosModule } from './modules/gastos/gastos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ImpresionModule } from './modules/impresion/impresion.module';

@Module({
  imports: [
    // M-01: ConfigModule global con validación Joi de variables de entorno obligatorias
    // Si faltan variables requeridas, la app falla con un mensaje claro en el arranque
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('12h'),
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        CORS_ORIGIN: Joi.string().default('http://localhost'),
        PRINTER_INTERFACE: Joi.string().optional(),
      }),
    }),

    // M-02: ThrottlerModule — Rate limiting global (10 req / 60 seg por IP)
    // El guard se aplicará por endpoint en AuthController cuando se implemente
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),

    PrismaModule,
    AuthModule,
    UsuariosModule,
    MesasModule,
    PedidosModule,
    CatalogoModule,
    DomiciliosModule,
    FacturacionModule,
    CajaModule,
    GastosModule,
    ReportesModule,
    ImpresionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
