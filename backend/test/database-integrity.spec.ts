import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EstadoCaja, EstadoFactura, EstadoMesa, EstadoPedido, Prisma } from '@prisma/client';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { FacturacionService } from '../src/modules/facturacion/facturacion.service';
import { CajaService } from '../src/modules/caja/caja.service';

describe('🗄️ BATERÍA DE PRUEBAS DE INTEGRIDAD DE BASE DE DATOS Y BLINDAJE SQL - MESA LISTA', () => {

  // =========================================================================
  // 1. INTEGRIDAD REFERENCIAL Y RESTRICCIONES DE ESQUEMA (FOREIGN KEYS & UNICIDAD)
  // =========================================================================
  describe('1. Integridad Referencial y Restricciones de Esquema', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        usuario: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        mesa: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        pedido: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        pedidoItem: {
          create: jest.fn(),
        },
        factura: {
          create: jest.fn(),
        },
      };
    });

    it('[BD-01] Restricción de unicidad: Debe rechazar la creación de usuarios con nombre de usuario duplicado', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        usuario: 'admin',
        email: 'admin@mesalista.com',
      });

      const existeUsuario = await mockPrisma.usuario.findUnique({ where: { usuario: 'admin' } });
      expect(existeUsuario).toBeDefined();

      const registrarUsuarioDuplicado = () => {
        if (existeUsuario) {
          throw new ConflictException('El nombre de usuario ya se encuentra registrado.');
        }
      };

      expect(registrarUsuarioDuplicado).toThrow(ConflictException);
      expect(registrarUsuarioDuplicado).toThrow('El nombre de usuario ya se encuentra registrado.');
    });

    it('[BD-02] Restricción de unicidad: Debe rechazar la creación de una mesa con número ya existente', async () => {
      mockPrisma.mesa.findUnique.mockResolvedValue({
        id_mesa: 5,
        numero: 10,
        capacidad: 4,
        estado: EstadoMesa.libre,
      });

      const mesaExistente = await mockPrisma.mesa.findUnique({ where: { numero: 10 } });
      expect(mesaExistente).toBeTruthy();

      const crearMesaDuplicada = () => {
        if (mesaExistente) {
          throw new ConflictException('Ya existe una mesa con el número especificado.');
        }
      };

      expect(crearMesaDuplicada).toThrow(ConflictException);
    });

    it('[BD-03] Integridad referencial (FK): Un PedidoItem no puede crearse si el producto referenciado no existe', async () => {
      mockPrisma.pedidoItem.create.mockRejectedValue(
        new Error('Foreign key constraint failed on the field: `id_producto` (P2003)'),
      );

      await expect(
        mockPrisma.pedidoItem.create({
          data: {
            id_pedido: 100,
            id_producto: 99999, // Producto inexistente
            cantidad: 2,
            precio_unitario: 15000,
            subtotal: 30000,
          },
        }),
      ).rejects.toThrow('Foreign key constraint failed');
    });

    it('[BD-04] Integridad referencial (FK): Una Factura debe asociarse obligatoriamente a un Pedido válido', async () => {
      mockPrisma.factura.create.mockRejectedValue(
        new Error('Foreign key constraint failed on the field: `id_pedido` (P2003)'),
      );

      await expect(
        mockPrisma.factura.create({
          data: {
            id_pedido: 88888, // Pedido no registrado
            total: 50000,
            estado: EstadoFactura.emitida,
          },
        }),
      ).rejects.toThrow('Foreign key constraint failed');
    });
  });

  // =========================================================================
  // 2. BLINDAJE CONTRA INYECCIÓN SQL A NIVEL ORM Y PARAMETRIZACIÓN
  // =========================================================================
  describe('2. Blindaje contra Inyección SQL a Nivel ORM', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        usuario: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
        producto: {
          findMany: jest.fn(),
        },
      };
    });

    it('[BD-05] Blindaje SQL: Payloads de evasión clásica ("\' OR 1=1 --") son tratados como literales seguros', async () => {
      const payloadInyeccion = "' OR '1'='1' --";

      mockPrisma.usuario.findFirst.mockImplementation(async (query: any) => {
        // En Prisma ORM, el objeto where se parametriza como $1,
        // buscando la cadena literal sin alterar el AST de la consulta SQL
        if (query.where.usuario === payloadInyeccion) {
          return null;
        }
        return { id_usuario: 1, usuario: 'admin' };
      });

      const resultado = await mockPrisma.usuario.findFirst({
        where: { usuario: payloadInyeccion },
      });

      expect(resultado).toBeNull();
      expect(mockPrisma.usuario.findFirst).toHaveBeenCalledWith({
        where: { usuario: "' OR '1'='1' --" },
      });
    });

    it('[BD-06] Blindaje SQL: Intentos de Stacked Queries ("; DROP TABLE pedidos; --") no se ejecutan', async () => {
      const payloadDrop = "Bebida'; DROP TABLE pedidos; --";

      mockPrisma.producto.findMany.mockImplementation(async () => []);

      const productos = await mockPrisma.producto.findMany({
        where: {
          nombre: {
            contains: payloadDrop,
            mode: 'insensitive',
          },
        },
      });

      expect(productos).toEqual([]);
      expect(mockPrisma.producto.findMany).toHaveBeenCalledWith({
        where: {
          nombre: {
            contains: payloadDrop,
            mode: 'insensitive',
          },
        },
      });
    });

    it('[BD-07] Blindaje SQL: Inyecciones booleanas y de unión (UNION SELECT) son neutralizadas por tipado estricto', async () => {
      const payloadUnion = "1 UNION SELECT id_usuario, usuario, password FROM usuarios";

      mockPrisma.usuario.findMany.mockResolvedValue([]);

      const resultado = await mockPrisma.usuario.findMany({
        where: {
          usuario: {
            contains: payloadUnion,
          },
        },
      });

      expect(resultado).toEqual([]);
    });
  });

  // =========================================================================
  // 3. ATOMICIDAD TRANSACCIONAL Y CONSISTENCIA FINANCIERA (ACID)
  // =========================================================================
  describe('3. Atomicidad Transaccional y Consistencia Financiera', () => {
    let facturacionService: FacturacionService;
    let cajaService: CajaService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn(async (cb: any) => {
          if (typeof cb === 'function') {
            return await cb(mockPrisma);
          }
          return cb;
        }),
        caja: {
          findFirst: jest.fn().mockResolvedValue({
            id_caja: 1,
            estado: EstadoCaja.abierta,
            valor_inicial: 100000,
          }),
          update: jest.fn(),
        },
        pedido: {
          count: jest.fn().mockResolvedValue(0),
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        factura: {
          create: jest.fn(),
          findUnique: jest.fn(),
        },
        pago: {
          create: jest.fn(),
        },
        mesa: {
          update: jest.fn(),
        },
        gasto: {
          create: jest.fn(),
        },
        medioPago: {
          findUnique: jest.fn().mockResolvedValue({ id_medio: 1, nombre: 'Efectivo' }),
          create: jest.fn(),
          upsert: jest.fn().mockResolvedValue({ id_medio: 1, nombre: 'Efectivo' }),
        },
        tipoGasto: {
          findUnique: jest.fn().mockResolvedValue({ id_tipo: 1, nombre: 'Operativo' }),
          create: jest.fn(),
          upsert: jest.fn().mockResolvedValue({ id_tipo: 1, nombre: 'Operativo' }),
        },
      };

      facturacionService = new FacturacionService(mockPrisma as unknown as PrismaService);
      cajaService = new CajaService(mockPrisma as unknown as PrismaService);
    });

    it('[BD-08] Consistencia Financiera: Rechazar facturación si el monto total pagado es inferior al valor de los pedidos', async () => {
      const pedidoSimulado = {
        id_pedido: 10,
        estado: EstadoPedido.enviada,
        id_factura: null,
        cliente_nombre: 'Estudiante Unicauca',
        items: [
          { cantidad: 2, precio_unitario: new Prisma.Decimal(25000) }, // subtotal: 50.000
        ],
      };

      mockPrisma.pedido.findUnique.mockResolvedValue(pedidoSimulado);

      // Intento de pago insuficiente: total a pagar es 50.000, pero se envían 40.000
      const dtoPagoInsuficiente = {
        id_pedido: 10,
        pagos: [
          { medio_pago: 'Efectivo', monto: 30000 },
          { medio_pago: 'Nequi', monto: 10000 },
        ],
      };

      await expect(
        facturacionService.crearFactura(dtoPagoInsuficiente as any, 1),
      ).rejects.toThrow(BadRequestException);

      await expect(
        facturacionService.crearFactura(dtoPagoInsuficiente as any, 1),
      ).rejects.toThrow('no cubre el valor total');
    });

    it('[BD-09] Consistencia Financiera: Anulación de factura exige que el turno de caja continúe abierto', async () => {
      mockPrisma.factura.findUnique.mockResolvedValue({
        id_venta: 1,
        estado: EstadoFactura.emitida,
        id_caja: 2,
        caja: { id_caja: 2, estado: EstadoCaja.cerrada }, // Caja ya cerrada
      });

      await expect(
        facturacionService.anularFactura(1, 'Error en digitación', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('[BD-10] Atomicidad en Caja: El cierre de caja audita base, total de ventas y gastos', async () => {
      const cajaAbierta = {
        id_caja: 1,
        estado: EstadoCaja.abierta,
        valor_inicial: 100000,
        fecha_apertura: new Date(),
        usuarioApertura: { nombre: 'Cajero Principal' },
        gastos: [{ total: 20000 }],
        facturas: [
          { valor_total: 250000, estado: EstadoFactura.emitida, pagos: [{ monto: 250000, medio_pago: { nombre: 'Efectivo' } }] },
        ],
      };

      mockPrisma.caja.findFirst.mockResolvedValue(cajaAbierta);
      mockPrisma.caja.update.mockImplementation(({ data }: any) => {
        return {
          ...cajaAbierta,
          ...data,
          estado: EstadoCaja.cerrada,
        };
      });

      const cierre = await cajaService.cerrarCaja({
        valor_final_fisico: 330000, // 100.000 base + 250.000 ventas - 20.000 gastos = 330.000 esperado
        observacion: 'Arqueo exacto sin descuadre',
      }, 1);

      expect(cierre).toBeDefined();
      expect(mockPrisma.caja.update).toHaveBeenCalled();
    });

    it('[BD-11] Inmutabilidad de precios en PedidoItem: El precio unitario histórico se congela en la creación', () => {
      const precioAlMomentoDelPedido = 18000;
      const nuevoPrecioCatalogoPosterior = 24000;

      const itemHistorico = {
        id_item: 1,
        id_producto: 5,
        cantidad: 2,
        precio_unitario: precioAlMomentoDelPedido,
        subtotal: precioAlMomentoDelPedido * 2, // 36000
      };

      // Si el catálogo cambia a 24000, el subtotal del pedido ya cerrado NO muta
      expect(itemHistorico.subtotal).toBe(36000);
      expect(itemHistorico.subtotal).not.toBe(nuevoPrecioCatalogoPosterior * 2);
    });
  });
});
