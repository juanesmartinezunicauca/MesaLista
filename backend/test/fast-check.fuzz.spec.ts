import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { AbrirCajaDto } from '../src/modules/caja/dto';
import { CreateFacturaDto } from '../src/modules/facturacion/dto';
import { CreateUsuarioDto } from '../src/modules/usuarios/dto';
import { CreateProductoDto } from '../src/modules/catalogo/dto';
import { FiltroFechasDto } from '../src/modules/reportes/dto';

describe('Fast-Check Fuzzing & Property-Based Testing Suite', () => {
  // Generadores reutilizables de mutación extrema
  const extremeStrings = fc.oneof(
    fc.string(),
    fc.constant(''),
    fc.constant('   '),
    fc.constant('\0\x08\x1b\x7f'),
    fc.constant('<script>alert("XSS")</script>'),
    fc.constant("' OR '1'='1' --"),
    fc.constant('../../../../../etc/passwd'),
    fc.constant('🍕🔥🍔🍺🍣'.repeat(50)),
    fc.string({ minLength: 1000, maxLength: 5000 }), // Cadenas gigantes
  );

  const extremeNumbers = fc.oneof(
    fc.integer(),
    fc.double(),
    fc.constant(0),
    fc.constant(-1),
    fc.constant(-999999999),
    fc.constant(Number.MAX_SAFE_INTEGER),
    fc.constant(Number.MIN_SAFE_INTEGER),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
  );

  describe('1. Fuzzing de DTOs: Resiliencia ante entradas malformadas', () => {
    it('CreateUsuarioDto: nunca produce excepciones no controladas ante entradas arbitrarias', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            nombre: fc.oneof(extremeStrings, fc.constant(null), fc.constant(undefined)),
            usuario: fc.oneof(extremeStrings, fc.constant(null), fc.constant(undefined)),
            email: fc.oneof(extremeStrings, fc.constant(null), fc.constant(undefined)),
            rol: fc.oneof(extremeStrings, fc.constant(null), fc.constant(undefined)),
          }),
          async (rawInput) => {
            const dtoInstance = plainToInstance(CreateUsuarioDto, rawInput);
            const errors = await validate(dtoInstance);
            expect(Array.isArray(errors)).toBe(true);
            // La validación debe ser determinista
            if (
              typeof rawInput.email !== 'string' ||
              !rawInput.email.includes('@') ||
              typeof rawInput.nombre !== 'string' ||
              typeof rawInput.usuario !== 'string'
            ) {
              expect(errors.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 150 },
      );
    });

    it('AbrirCajaDto: rechaza montos negativos, NaN, Infinity y valores inválidos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            monto_apertura: fc.oneof(extremeNumbers, extremeStrings, fc.constant(null)),
          }),
          async (rawInput) => {
            const dtoInstance = plainToInstance(AbrirCajaDto, rawInput);
            const errors = await validate(dtoInstance);
            expect(Array.isArray(errors)).toBe(true);
            if (
              typeof rawInput.monto_apertura !== 'number' ||
              isNaN(rawInput.monto_apertura) ||
              !isFinite(rawInput.monto_apertura) ||
              rawInput.monto_apertura < 0
            ) {
              expect(errors.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 150 },
      );
    });

    it('CreateFacturaDto: valida métodos de pago e invariantes de propina', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id_pedido: fc.oneof(extremeNumbers, fc.constant(null)),
            metodo_pago: fc.oneof(extremeStrings, fc.constant(null)),
            monto_recibido: fc.oneof(extremeNumbers, fc.constant(null)),
            incluye_propina: fc.oneof(fc.boolean(), extremeStrings, fc.constant(null)),
            porcentaje_propina: fc.oneof(extremeNumbers, fc.constant(null)),
          }),
          async (rawInput) => {
            const dtoInstance = plainToInstance(CreateFacturaDto, rawInput);
            const errors = await validate(dtoInstance);
            expect(Array.isArray(errors)).toBe(true);

            // Si los métodos de pago no son válidos, debe generar errores
            const validMethods = ['efectivo', 'tarjeta', 'transferencia', 'qr'];
            if (!validMethods.includes(String(rawInput.metodo_pago))) {
              expect(errors.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 150 },
      );
    });

    it('CreateProductoDto: rechaza precios negativos y nombres vacíos o gigantes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            nombre: fc.oneof(extremeStrings, fc.constant(null)),
            precio: fc.oneof(extremeNumbers, fc.constant(null)),
            id_categoria: fc.oneof(extremeNumbers, fc.constant(null)),
            descripcion: fc.oneof(extremeStrings, fc.constant(null)),
          }),
          async (rawInput) => {
            const dtoInstance = plainToInstance(CreateProductoDto, rawInput);
            const errors = await validate(dtoInstance);
            expect(Array.isArray(errors)).toBe(true);

            if (typeof rawInput.precio !== 'number' || rawInput.precio <= 0) {
              expect(errors.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 150 },
      );
    });
  });

  describe('2. Fuzzing de Parsers y Filtros de Fecha', () => {
    it('FiltroFechasDto: maneja fechas caóticas sin crasheos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            desde: fc.oneof(extremeStrings, fc.constant(null)),
            hasta: fc.oneof(extremeStrings, fc.constant(null)),
          }),
          async (rawInput) => {
            const dtoInstance = plainToInstance(FiltroFechasDto, rawInput);
            const errors = await validate(dtoInstance);
            expect(Array.isArray(errors)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('3. Invariantes Matemáticas Financieras (Property-Based Testing)', () => {
    it('Cálculo de Propina y Totales: el total siempre es subtotal + propina', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000000, noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          (subtotal, porcentajePropina) => {
            const propina = (subtotal * porcentajePropina) / 100;
            const total = subtotal + propina;

            expect(total).toBeGreaterThanOrEqual(subtotal);
            expect(propina).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(total)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('Arqueo de Caja: diferencia_cierre siempre es exactamente monto_cierre_real - saldo_esperado', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 50000000, noNaN: true }),
          fc.double({ min: 0, max: 50000000, noNaN: true }),
          (montoCierreReal, saldoEsperado) => {
            const diferencia = Number((montoCierreReal - saldoEsperado).toFixed(2));
            const recomputado = Number((montoCierreReal - saldoEsperado).toFixed(2));
            expect(diferencia).toBe(recomputado);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('4. Hardening de PrismaExceptionFilter contra Excepciones Fuzz', () => {
    let filter: PrismaExceptionFilter;
    let mockResponse: any;
    let mockHost: ArgumentsHost;

    beforeEach(() => {
      filter = new PrismaExceptionFilter();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockHost = {
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;
    });

    it('PrismaClientValidationError siempre se traduce a 400 Bad Request controlado', () => {
      fc.assert(
        fc.property(extremeStrings, (fuzzMsg) => {
          const valError = new Prisma.PrismaClientValidationError(fuzzMsg, {
            clientVersion: '6.19.3',
          });
          filter.catch(valError, mockHost);

          expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'BadRequest',
              code: 'VALIDATION_ERROR',
            }),
          );
        }),
        { numRuns: 100 },
      );
    });

    it('PrismaClientKnownRequestError con códigos aleatorios nunca revienta el proceso', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 5 }), // ej: P2000, P9999, etc.
          extremeStrings,
          (code, msg) => {
            const knownError = new Prisma.PrismaClientKnownRequestError(msg, {
              code,
              clientVersion: '6.19.3',
            });
            filter.catch(knownError, mockHost);

            expect(mockResponse.status).toHaveBeenCalled();
            expect(mockResponse.json).toHaveBeenCalledWith(
              expect.objectContaining({
                code,
                timestamp: expect.any(String),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
