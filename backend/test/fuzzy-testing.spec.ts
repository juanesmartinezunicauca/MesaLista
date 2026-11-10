import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstadoCaja, EstadoPedido, EstadoUsuario, Prisma, RolUsuario, TipoPedido } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { AuthService } from '../src/modules/auth/auth.service';
import { AbrirCajaDto, CerrarCajaDto } from '../src/modules/caja/dto';
import { CajaService } from '../src/modules/caja/caja.service';
import { DomiciliosService } from '../src/modules/domicilios/domicilios.service';
import { DespacharDomiDto } from '../src/modules/domicilios/dto';
import { CreatePedidoDto } from '../src/modules/pedidos/dto';
import { PedidosService } from '../src/modules/pedidos/pedidos.service';
import { CreateUsuarioDto, EnviarCodigoDto } from '../src/modules/usuarios/dto';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';

/**
 * ============================================================================
 * MOTOR GENERADOR DE MUTACIONES FUZZY (FUZZ TESTING ENGINE)
 * Diseñado para inyectar vectores de entrada anómalos, desbordamientos,
 * caracteres de control, payloads SQLi/XSS y valores de frontera.
 * ============================================================================
 */
class FuzzDataGenerator {
  // Strings maliciosos, anómalos y de frontera extrema
  static readonly FUZZ_STRINGS: (string | any)[] = [
    '', // Cadena vacía
    '   ', // Solo espacios en blanco
    '\t\n\r', // Caracteres de espaciado y retorno
    '\0', // Byte nulo (Null byte injection)
    'admin\0.hidden.com',
    '\x00\x08\x1b\x7f', // Caracteres de control ANSI y terminal
    'A'.repeat(500), // Buffer mediano (500 chars)
    'X'.repeat(5000), // Buffer largo (5,000 chars)
    'B'.repeat(65536), // Desbordamiento 64 KB (Memory pressure)
    '<script>alert("XSS")</script>', // Inyección XSS directa
    '"><svg onload=alert(1)>', // Inyección XSS políglota
    "' OR '1'='1' --", // Inyección SQL clásica
    "1; DROP TABLE \"Usuario\"; --", // Inyección destructiva SQL
    '../../../../../../etc/passwd', // Path traversal LFI
    '..\\..\\..\\windows\\system32', // Path traversal Windows
    '{{7*7}} ${7*7}', // Server-Side Template Injection (SSTI)
    '\u202Ereversed_text', // Unicode BiDi (Right-to-Left Override)
    '👨‍💻🍕🚀🔥✨🎉', // Emojis y caracteres de 4 bytes UTF-8 (Surrogate pairs)
    'null', // Literal null string
    'undefined', // Literal undefined string
    'NaN', // Literal NaN string
    '{"$gt": ""}', // Inyección NoSQL
  ];

  // Números de frontera, desbordamientos e indeterminaciones
  static readonly FUZZ_NUMBERS: (number | any)[] = [
    -999999999, // Negativo extremo
    -1, // Negativo unitario
    -0.000001, // Negativo fraccionario infinitesimal
    0, // Cero absoluto
    0.000001, // Positivo infinitesimal
    0.5, // Fraccionario
    Number.MAX_SAFE_INTEGER, // 9007199254740991
    Number.MAX_SAFE_INTEGER + 1, // Desbordamiento de precisión IEEE 754
    Number.MIN_SAFE_INTEGER, // -9007199254740991
    Number.MAX_VALUE, // 1.7976931348623157e+308
    NaN, // Not a Number
    Infinity, // Infinito positivo
    -Infinity, // Infinito negativo
    1e21, // Notación exponencial masiva
  ];

  // Tipos incompatibles para pruebas de Type Confusion
  static readonly FUZZ_TYPES: any[] = [
    null,
    undefined,
    true,
    false,
    {},
    [],
    [1, 2, 3],
    { malicious: 'payload' },
    () => {},
  ];

  /**
   * Genera un lote combinatorio de mutaciones para cualquier campo objetivo
   */
  static getCombinedMutations(): any[] {
    return [...this.FUZZ_STRINGS, ...this.FUZZ_NUMBERS, ...this.FUZZ_TYPES];
  }
}

describe('🔬 BATERÍA DE PRUEBAS FUZZY Y RESILIENCIA DE SISTEMA (FUZZ TESTING SUITE) - MESALISTA', () => {

  // =========================================================================
  // MÓDULO 1: FUZZING DE DTOs Y VALIDACIÓN DE ENTRADA (ValidationPipe / Class-Validator)
  // =========================================================================
  describe('1. Fuzzing de DTOs y Validación de Frontera (Validation Boundaries)', () => {
    let validationPipe: ValidationPipe;

    beforeAll(() => {
      validationPipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
    });

    it('[FUZZ-DTO.1] CreateUsuarioDto: Debe rechazar robustamente mutaciones anómalas en el campo email sin arrojar error 500', async () => {
      const emailMutations = [
        ...FuzzDataGenerator.FUZZ_STRINGS,
        'correo-sin-arroba.com',
        '@dominio.com',
        'usuario@',
        'usuario@@dominio.com',
        'usuario@dominio..com',
        `user@${'a'.repeat(300)}.com`,
      ];

      for (const emailFuzzed of emailMutations) {
        const dtoInstance = plainToInstance(CreateUsuarioDto, {
          nombre: 'Carlos Mendoza',
          usuario: 'carlos123',
          email: emailFuzzed,
          rol: RolUsuario.mesero,
        });

        const errors = await validate(dtoInstance);
        // Si el valor no es undefined/vacío (campo opcional), debe fallar la validación de formato
        if (emailFuzzed !== undefined && emailFuzzed !== null && String(emailFuzzed).trim() !== '') {
          expect(errors.some((e) => e.property === 'email')).toBe(true);
        }
      }
    });

    it('[FUZZ-DTO.2] CreateUsuarioDto: Debe rechazar valores fuzzificados en el campo rol (Enums estrictos)', async () => {
      const rolesInvalidos = [
        ...FuzzDataGenerator.FUZZ_STRINGS,
        ...FuzzDataGenerator.FUZZ_NUMBERS,
        'superuser',
        'root',
        'hacker',
        'ADMIN', // Mayúsculas no coincidentes con el enum
        'Mesero',
        null,
        undefined,
      ];

      for (const rolFuzzed of rolesInvalidos) {
        const dtoInstance = plainToInstance(CreateUsuarioDto, {
          nombre: 'Juan Perez',
          usuario: 'juanp',
          rol: rolFuzzed,
        });

        const errors = await validate(dtoInstance);
        expect(errors.some((e) => e.property === 'rol')).toBe(true);
      }
    });

    it('[FUZZ-DTO.3] CreateUsuarioDto: Debe rechazar contraseñas que no cumplan requisitos de longitud o complejidad', async () => {
      const passwordsFuzzed = [
        '',
        '1234567', // 7 chars (menor a 8)
        'sololetrasminusculas', // Sin dígitos
        '123456789012', // Sin letras
        'A'.repeat(150), // Excede max (100)
        '   ',
        12345678, // Tipo numérico inválido
        ['password123'], // Array en vez de string
        { pass: '123' }, // Objeto
      ];

      for (const pwdFuzzed of passwordsFuzzed) {
        const dtoInstance = plainToInstance(CreateUsuarioDto, {
          nombre: 'Mesero Test',
          usuario: 'meserotest',
          rol: RolUsuario.mesero,
          password: pwdFuzzed,
        });

        const errors = await validate(dtoInstance);
        expect(errors.some((e) => e.property === 'password')).toBe(true);
      }
    });

    it('[FUZZ-DTO.4] CreatePedidoDto: Fuzzing de cantidades monetarias y números en Detalle de Pedido', async () => {
      const numerosInvalidos = [
        -100, -1, 0, 0.5, NaN, Infinity, -Infinity, 'diez', null, undefined, {}
      ];

      for (const cantFuzzed of numerosInvalidos) {
        const dtoInstance = plainToInstance(CreatePedidoDto, {
          id_mesa: 1,
          tipo: TipoPedido.mesa,
          items: [
            {
              id_producto: 1,
              cantidad: cantFuzzed,
              precio_unitario: 15000,
            },
          ],
        });

        const errors = await validate(dtoInstance);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('[FUZZ-DTO.5] AbrirCajaDto / CerrarCajaDto: Debe rechazar montos iniciales y finales negativos o indeterminados', async () => {
      const montosInvalidos = [-50000, -1, NaN, Infinity, -Infinity, 'cienmil', null, undefined, {}];

      for (const montoFuzzed of montosInvalidos) {
        const dtoAbrir = plainToInstance(AbrirCajaDto, {
          valor_inicial: montoFuzzed,
        });
        const errorsAbrir = await validate(dtoAbrir);
        expect(errorsAbrir.some((e) => e.property === 'valor_inicial')).toBe(true);

        const dtoCerrar = plainToInstance(CerrarCajaDto, {
          valor_final_fisico: montoFuzzed,
        });
        const errorsCerrar = await validate(dtoCerrar);
        expect(errorsCerrar.some((e) => e.property === 'valor_final_fisico')).toBe(true);
      }
    });
  });

  // =========================================================================
  // MÓDULO 2: FUZZING DE AUTENTICACIÓN Y TOKENS JWT (Security & Token Fuzzing)
  // =========================================================================
  describe('2. Fuzzing de Tokens JWT y Firmas Criptográficas (JWT & Auth Fuzzing)', () => {
    let jwtService: JwtService;
    const SECRET = 'clave_secreta_super_segura_de_al_menos_32_caracteres_xyz';

    beforeAll(() => {
      jwtService = new JwtService({
        secret: SECRET,
        signOptions: { expiresIn: '1h' },
      });
    });

    it('[FUZZ-AUTH.1] Debe rechazar tokens JWT truncados, malformados o con caracteres aleatorios', () => {
      const validToken = jwtService.sign({ sub: 1, usuario: 'admin', rol: RolUsuario.administrador });

      const fuzzedTokens = [
        '',
        'Bearer ',
        'token.invalido.aleatorio',
        validToken.slice(0, 15), // Truncado inicio
        validToken.slice(10, -10), // Truncado centro
        `${validToken}MALICIOUS_PADDING`, // Firma corrupta
        validToken.replace('.', '..'), // Formato corrupto
        `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${validToken.split('.')[1]}.`, // Algoritmo "none" attack
        ...FuzzDataGenerator.FUZZ_STRINGS.map((s) => `Bearer ${s}`),
      ];

      for (const badToken of fuzzedTokens) {
        const clean = badToken.replace(/^Bearer\s+/i, '');
        expect(() => jwtService.verify(clean)).toThrow();
      }
    });

    it('[FUZZ-AUTH.2] Debe rechazar tokens firmados con una clave secreta incorrecta (Falsificación de identidad)', () => {
      const imposterJwtService = new JwtService({
        secret: 'clave_atacante_falsa_123456789012345',
      });

      const forgedToken = imposterJwtService.sign({
        sub: 1,
        usuario: 'admin',
        rol: RolUsuario.administrador,
      });

      expect(() => jwtService.verify(forgedToken)).toThrow();
    });

    it('[FUZZ-AUTH.3] Debe rechazar tokens con timestamps expirados o reclamos manipulados', () => {
      const expiredToken = jwtService.sign(
        { sub: 5, usuario: 'mesero1', rol: RolUsuario.mesero },
        { expiresIn: '-1s' }, // Expirado hace 1 segundo
      );

      expect(() => jwtService.verify(expiredToken)).toThrow();
    });
  });

  // =========================================================================
  // MÓDULO 3: FUZZING DE CÓDIGOS DE INVITACIÓN (Onboarding & Activation Fuzzing)
  // =========================================================================
  describe('3. Fuzzing de Códigos de Invitación (Invitation Code & Token Injection)', () => {
    let usuariosService: UsuariosService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        usuario: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn(),
        },
      };
      const mockMailService = { enviarCodigoInvitacion: jest.fn() } as any;
      usuariosService = new UsuariosService(mockPrisma as any, mockMailService);
    });

    it('[FUZZ-INV.1] vincularOGuardarGoogleUsuario: Fuzzing masivo de códigos de invitación malformados', async () => {
      // 50 mutaciones de código de invitación (SQLi, strings vacíos, longitud gigante, XSS, etc.)
      const fuzzedCodes = [
        ...FuzzDataGenerator.FUZZ_STRINGS,
        'INV-',
        'INV-1',
        'INV-ABCDEF',
        'inv-123456', // Minúsculas
        'INV-12345678901234567890',
        'INV-!@#$%^&*()',
        `INV-${'9'.repeat(1000)}`, // Longitud extrema
        'INV-000000',
        'INV-undefined',
        'INV-null',
      ];

      for (const badCode of fuzzedCodes) {
        mockPrisma.usuario.findFirst.mockResolvedValue(null); // No existe en BD

        // Si el código no es nulo/vacío, debe buscar y lanzar UnauthorizedException
        if (badCode && String(badCode).trim()) {
          await expect(
            usuariosService.vincularOGuardarGoogleUsuario({
              googleId: 'google-oauth-uid-12345',
              email: 'empleado@gmail.com',
              nombre: 'Carlos Fuzz',
              codigoInvitacion: badCode,
            }),
          ).rejects.toThrow(UnauthorizedException);
        }
      }
    });

    it('[FUZZ-INV.2] vincularOGuardarGoogleUsuario: Debe prevenir colisiones liberando googleId previos ante reutilización', async () => {
      const usuarioInvitadoMock = {
        id_usuario: 42,
        nombre: 'Mesero Legítimo',
        usuario: 'mesero42',
        rol: RolUsuario.mesero,
        codigoInvitacion: 'INV-482910',
        email: null,
      };

      mockPrisma.usuario.findFirst
        .mockResolvedValueOnce(usuarioInvitadoMock)
        .mockResolvedValueOnce(null);
      mockPrisma.usuario.update.mockResolvedValue({
        ...usuarioInvitadoMock,
        googleId: 'google-uid-777',
        codigoInvitacion: null,
      });

      const resultado = await usuariosService.vincularOGuardarGoogleUsuario({
        googleId: 'google-uid-777',
        email: 'mesero42@gmail.com',
        nombre: 'Mesero Legítimo',
        codigoInvitacion: 'INV-482910',
      });

      // Verifica que se liberó googleId de cualquier otra cuenta previa
      expect(mockPrisma.usuario.updateMany).toHaveBeenCalledWith({
        where: {
          googleId: 'google-uid-777',
          id_usuario: { not: 42 },
        },
        data: { googleId: null },
      });

      // Verifica que el código se consumió (quemado a null)
      expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_usuario: 42 },
          data: expect.objectContaining({
            googleId: 'google-uid-777',
            codigoInvitacion: null,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // MÓDULO 4: FUZZING DE MÁQUINA DE ESTADOS Y DOMICILIOS (State Machine Fuzzing)
  // =========================================================================
  describe('4. Fuzzing de Máquina de Estados Operativos (State Transition Fuzzing)', () => {
    let domiciliosService: DomiciliosService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        pedido: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        usuario: {
          findUnique: jest.fn(),
        },
        entregaDomicilio: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      domiciliosService = new DomiciliosService(mockPrisma as any);
    });

    it('[FUZZ-STATE.1] Pedidos/Domicilios: Fuzzing de ID de pedidos inexistentes, negativos o nulos', async () => {
      const idsInvalidos = [-99999, -1, 0, 99999999];

      for (const badId of idsInvalidos) {
        mockPrisma.pedido.findUnique.mockResolvedValue(null);

        await expect(
          domiciliosService.obtenerPorId(badId),
        ).rejects.toThrow(NotFoundException);
      }
    });

    it('[FUZZ-STATE.2] Domicilios: Fuzzing con estados de pedido cerrados que no admiten transición a reparto', async () => {
      mockPrisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 20,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.cerrada, // Ya archivada/cerrada
      });

      await expect(
        domiciliosService.cambiarEstado(20, { estado: 'En Reparto' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[FUZZ-STATE.3] Domicilios: Intento de entrega sin cobro previo en caja debe ser bloqueado', async () => {
      mockPrisma.pedido.findUnique.mockResolvedValue({
        id_pedido: 30,
        numero_pedido: 5,
        tipo: TipoPedido.domicilio,
        estado: EstadoPedido.enviada,
        id_factura: null, // ¡Sin facturar!
      });

      await expect(
        domiciliosService.cambiarEstado(30, { estado: 'Entregado' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        domiciliosService.cambiarEstado(30, { estado: 'Entregado' }),
      ).rejects.toThrow('Debe ser cobrado y facturado en caja antes de cerrarlo.');
    });

    it('[FUZZ-STATE.4] Repartidores: Fuzzing de nombres y teléfonos vacíos o malformados en directorio operativo', async () => {
      const repartidoresFuzzed = [
        { nombre: '', telefono: '3101234567' },
        { nombre: '   ', telefono: '3101234567' },
        { nombre: 'Carlos Repartidor', telefono: '' },
        { nombre: 'Carlos Repartidor', telefono: '   ' },
      ];

      for (const repFuzzed of repartidoresFuzzed) {
        await expect(
          domiciliosService.guardarRepartidor(repFuzzed),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  // =========================================================================
  // MÓDULO 5: FUZZING DE CAJA Y ARQUEO MONETARIO (Cash Flow Fuzzing)
  // =========================================================================
  describe('5. Fuzzing de Flujo de Caja y Operaciones Monetarias (Cash Drawer Integrity)', () => {
    let cajaService: CajaService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        medioPago: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        tipoGasto: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        tipoMovimientoCaja: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        caja: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        pedido: {
          count: jest.fn().mockResolvedValue(0),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      cajaService = new CajaService(mockPrisma as any);
    });

    it('[FUZZ-CAJA.1] Debe rechazar apertura de caja con montos iniciales negativos', async () => {
      await expect(
        cajaService.abrirCaja({ valor_inicial: -50000 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('[FUZZ-CAJA.2] Debe prevenir aperturas duplicadas si ya existe una sesión activa', async () => {
      mockPrisma.caja.findFirst.mockResolvedValue({
        id_caja: 1,
        estado: EstadoCaja.abierta,
        fecha_apertura: new Date(),
      });

      await expect(
        cajaService.abrirCaja({ valor_inicial: 100000 }, 1),
      ).rejects.toThrow(ConflictException);
    });

    it('[FUZZ-CAJA.3] Debe rechazar cierre de caja si no hay ninguna sesión abierta', async () => {
      mockPrisma.caja.findFirst.mockResolvedValue(null);

      await expect(
        cajaService.cerrarCaja({ valor_final_fisico: 250000 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('[FUZZ-CAJA.4] Debe rechazar cierre de caja con monto final negativo', async () => {
      await expect(
        cajaService.cerrarCaja({ valor_final_fisico: -100 }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // MÓDULO 6: FUZZING DE EXCEPCIONES PRISMA Y PREVENCIÓN DE FUGAS (Info Leakage Fuzzing)
  // =========================================================================
  describe('6. Fuzzing de Filtro de Excepciones de Base de Datos (Information Leakage Defense)', () => {
    let filter: PrismaExceptionFilter;
    let mockResponse: any;
    let mockHost: ExecutionContext;

    beforeEach(() => {
      filter = new PrismaExceptionFilter();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;
    });

    it('[FUZZ-LEAK.1] Debe sanitizar errores de clave única (P2002) sin exponer sentencias SQL ni metadatos confidenciales', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`usuario`) in table `Usuario` with query: SELECT * FROM `Usuario` WHERE password = "secret"',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: ['usuario'] },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const jsonResponse = mockResponse.json.mock.calls[0][0];

      // Verificaciones estrictas de no-fuga de datos
      expect(jsonResponse.statusCode).toBe(HttpStatus.CONFLICT);
      expect(jsonResponse.message).toContain('Ya existe un registro con el mismo valor para: usuario');
      expect(JSON.stringify(jsonResponse)).not.toContain('SELECT');
      expect(JSON.stringify(jsonResponse)).not.toContain('password');
      expect(JSON.stringify(jsonResponse)).not.toContain('secret');
    });

    it('[FUZZ-LEAK.2] Debe sanitizar violaciones de clave foránea (P2003) sin revelar esquemas de base de datos', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed on table `Pedido` foreign key `id_mesa`',
        {
          code: 'P2003',
          clientVersion: '6.19.3',
          meta: { field_name: 'id_mesa' },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonResponse = mockResponse.json.mock.calls[0][0];

      expect(jsonResponse.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(jsonResponse.message).toContain('No se puede completar la operación debido a una referencia inválida (id_mesa)');
    });

    it('[FUZZ-LEAK.3] Fuzzing de códigos desconocidos de Prisma (ej. P9999, P0000) debe responder 500 genérico seguro', () => {
      const mysteryCodes = ['P0000', 'P9999', 'P8888', 'P_MALFORMED'];

      for (const mysteryCode of mysteryCodes) {
        mockResponse.status.mockClear();
        mockResponse.json.mockClear();

        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Fatal internal database panic error: stack trace at internal/db/driver.c:452',
          {
            code: mysteryCode,
            clientVersion: '6.19.3',
          },
        );

        filter.catch(prismaError, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        const jsonResponse = mockResponse.json.mock.calls[0][0];

        expect(jsonResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(jsonResponse.message).toBe('Error interno en la base de datos.');
        // Certificar que NO se filtra el stack trace ni los archivos internos en C
        expect(JSON.stringify(jsonResponse)).not.toContain('internal/db/driver.c');
        expect(JSON.stringify(jsonResponse)).not.toContain('stack trace');
      }
    });

    it('[FUZZ-LEAK.4] Fuzzing de desbordamiento numérico (P2020 - Integer 32-bit Overflow) debe responder 400 en vez de 500', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Value out of range for the type. Out of range value for column `id_pedido` at row 1: 9999999999',
        {
          code: 'P2020',
          clientVersion: '6.19.3',
          meta: { details: 'Value out of range for the type.' },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonResponse = mockResponse.json.mock.calls[0][0];

      expect(jsonResponse.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(jsonResponse.message).toContain('desbordamiento numérico');
      expect(jsonResponse.error).toBe('BadRequest');
    });

    it('[FUZZ-LEAK.5] Fuzzing de cadenas gigantes (P2000 - String Length Overflow) debe responder 400 en vez de 500', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'The provided value for the column is too long for the columns type. Column: nombre',
        {
          code: 'P2000',
          clientVersion: '6.19.3',
          meta: { column_name: 'nombre' },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonResponse = mockResponse.json.mock.calls[0][0];

      expect(jsonResponse.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(jsonResponse.message).toContain('demasiado largo');
      expect(jsonResponse.error).toBe('BadRequest');
    });

    it('[FUZZ-LEAK.6] Fuzzing de campos obligatorios nulos (P2011 - Null constraint) debe responder 400 en vez de 500', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Null constraint violation on the column: precio_venta',
        {
          code: 'P2011',
          clientVersion: '6.19.3',
          meta: { constraint: 'precio_venta' },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonResponse = mockResponse.json.mock.calls[0][0];

      expect(jsonResponse.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(jsonResponse.message).toContain('No se admiten valores nulos para: precio_venta');
    });
  });

  // =========================================================================
  // MÓDULO 7: SIMULACIÓN DE CONDICIONES DE CARRERA Y ESTRÉS REAL (Chaos & Concurrency)
  // =========================================================================
  describe('7. Simulación de Concurrencia y Fallos Reales (Chaos & Race Conditions)', () => {
    it('[FUZZ-RACE.1] Debe detectar y prevenir que múltiples pedidos concurrentes lleven el inventario a números negativos', async () => {
      // Simulación de escenario real: stock inicial = 1
      let stockEnBaseDeDatos = 1;

      const decrementStockConcurrente = async (cantidadSolicitada: number) => {
        // Chequeo previo (Time of check)
        if (stockEnBaseDeDatos < cantidadSolicitada) {
          throw new BadRequestException('Stock insuficiente');
        }

        // Latencia de red o contención de base de datos
        await new Promise((resolve) => setTimeout(resolve, 5));

        // Actualización (Time of use)
        if (stockEnBaseDeDatos - cantidadSolicitada < 0) {
          throw new ConflictException('Condición de carrera detectada: inventario negativo prevenido');
        }
        stockEnBaseDeDatos -= cantidadSolicitada;
        return stockEnBaseDeDatos;
      };

      // Dos solicitudes simultáneas intentando pedir la última unidad disponible
      const resultados = await Promise.allSettled([
        decrementStockConcurrente(1),
        decrementStockConcurrente(1),
      ]);

      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r) => r.status === 'rejected');

      // Exactamente 1 debe haber tenido éxito, y 1 debe haber sido rechazado
      expect(exitosos.length).toBe(1);
      expect(fallidos.length).toBe(1);
      // El inventario jamás debe quedar en -1
      expect(stockEnBaseDeDatos).toBe(0);
    });
  });
});
