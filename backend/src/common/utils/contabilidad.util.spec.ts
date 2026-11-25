import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../filters/prisma-exception.filter';
import {
  esOrigenCorsPermitido,
  normalizarMedioPago,
  redondearMoneda,
} from './contabilidad.util';

describe('Contabilidad y Seguridad Utilidades', () => {
  describe('normalizarMedioPago', () => {
    it('no debe clasificar "Depósito bancario" como tarjeta por subcadena "pos"', () => {
      expect(normalizarMedioPago('Depósito')).toBe('efectivo');
      expect(normalizarMedioPago('Deposito bancario')).toBe('efectivo');
    });

    it('debe clasificar correctamente tarjeta/datáfono/POS, transferencias/Nequi/QR y efectivo', () => {
      expect(normalizarMedioPago('Datáfono')).toBe('tarjeta');
      expect(normalizarMedioPago('Terminal POS')).toBe('tarjeta');
      expect(normalizarMedioPago('Tarjeta Débito')).toBe('tarjeta');
      expect(normalizarMedioPago('Nequi')).toBe('transferencia');
      expect(normalizarMedioPago('Daviplata')).toBe('transferencia');
      expect(normalizarMedioPago('Pago QR Bancolombia')).toBe('transferencia');
      expect(normalizarMedioPago('PSE')).toBe('transferencia');
      expect(normalizarMedioPago('Efectivo')).toBe('efectivo');
      expect(normalizarMedioPago(null)).toBe('efectivo');
    });

    it('debe redondear valores monetarios a 2 decimales sin errores IEEE 754', () => {
      expect(redondearMoneda(0.1 + 0.2)).toBe(0.3);
      expect(redondearMoneda(12345.678)).toBe(12345.68);
    });
  });

  describe('esOrigenCorsPermitido', () => {
    it('debe permitir localhost exacto, despliegues oficiales mesa-lista en Vercel y CORS_ORIGIN', () => {
      expect(esOrigenCorsPermitido(undefined, [])).toBe(true);
      expect(esOrigenCorsPermitido('http://localhost:4200', [])).toBe(true);
      expect(esOrigenCorsPermitido('http://127.0.0.1:3000', [])).toBe(true);
      expect(esOrigenCorsPermitido('https://mesa-lista-virid.vercel.app', [])).toBe(true);
      expect(esOrigenCorsPermitido('https://mesa-lista-frontend.vercel.app', [])).toBe(true);
      expect(esOrigenCorsPermitido('https://pos.luigies.co', ['https://pos.luigies.co'])).toBe(true);
    });

    it('debe rechazar bypasses por subcadena (localhost.atacante.com y *.vercel.app ajenos)', () => {
      expect(esOrigenCorsPermitido('https://localhost.atacante.com', [])).toBe(false);
      expect(esOrigenCorsPermitido('https://127.0.0.1.evil.org', [])).toBe(false);
      expect(esOrigenCorsPermitido('https://evil-phishing.vercel.app', [])).toBe(false);
      expect(esOrigenCorsPermitido('http://mesa-lista-virid.vercel.app', [])).toBe(false);
      expect(esOrigenCorsPermitido('not-a-valid-url', [])).toBe(false);
    });
  });

  describe('PrismaExceptionFilter - errores críticos de motor/conexión', () => {
    const crearHostMock = () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as any;
      return { host, status, json };
    };

    it('debe responder 500 Internal Server Error ante PrismaClientRustPanicError', () => {
      const filter = new PrismaExceptionFilter();
      const { host, status, json } = crearHostMock();
      const panic = new Prisma.PrismaClientRustPanicError('panic in query engine', '6.19.3');

      filter.catch(panic, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DB_PANIC_ERROR',
        }),
      );
    });

    it('debe responder 500 para fallos de BD desconocidos y 400 solo para errores de codificación UTF-8/null-byte', () => {
      const filter = new PrismaExceptionFilter();
      const { host: h1, status: s1 } = crearHostMock();
      filter.catch(
        new Prisma.PrismaClientUnknownRequestError('Connection terminated unexpectedly', {
          clientVersion: '6.19.3',
        }),
        h1,
      );
      expect(s1).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

      const { host: h2, status: s2 } = crearHostMock();
      filter.catch(
        new Prisma.PrismaClientUnknownRequestError('invalid byte sequence for encoding "UTF8": 0x00', {
          clientVersion: '6.19.3',
        }),
        h2,
      );
      expect(s2).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });
});
