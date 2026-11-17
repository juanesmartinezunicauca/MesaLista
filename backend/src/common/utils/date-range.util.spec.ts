import { BadRequestException } from '@nestjs/common';
import { resolverRangoFechaOpcional } from './date-range.util';

describe('resolverRangoFechaOpcional', () => {
  it('debe retornar undefined cuando no se envían filtros de fecha', () => {
    expect(resolverRangoFechaOpcional()).toBeUndefined();
    expect(resolverRangoFechaOpcional({})).toBeUndefined();
  });

  it('debe resolver un día único en horario Colombia (-05:00)', () => {
    const rango = resolverRangoFechaOpcional({ fecha: '2026-11-16' });
    expect(rango?.gte?.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(rango?.lte?.toISOString()).toBe('2026-11-17T04:59:59.999Z');
  });

  it('debe resolver un rango fecha_inicio y fecha_fin completo', () => {
    const rango = resolverRangoFechaOpcional({
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-15',
    });
    expect(rango?.gte?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(rango?.lte?.toISOString()).toBe('2026-11-16T04:59:59.999Z');
  });

  it('debe aceptar solo fecha_inicio o solo fecha_fin', () => {
    const soloInicio = resolverRangoFechaOpcional({ fecha_inicio: '2026-11-10' });
    expect(soloInicio?.gte?.toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(soloInicio?.lte).toBeUndefined();

    const soloFin = resolverRangoFechaOpcional({ fecha_fin: '2026-11-10' });
    expect(soloFin?.gte).toBeUndefined();
    expect(soloFin?.lte?.toISOString()).toBe('2026-11-11T04:59:59.999Z');
  });

  it('debe lanzar BadRequestException cuando fecha_inicio > fecha_fin', () => {
    expect(() =>
      resolverRangoFechaOpcional({
        fecha_inicio: '2026-11-20',
        fecha_fin: '2026-11-10',
      }),
    ).toThrow(BadRequestException);
  });

  it('debe rechazar fechas calendario inexistentes o formatos inválidos', () => {
    expect(() => resolverRangoFechaOpcional({ fecha: '2026-02-30' })).toThrow(BadRequestException);
    expect(() => resolverRangoFechaOpcional({ fecha: 'invalid-date' })).toThrow(BadRequestException);
    expect(() => resolverRangoFechaOpcional({ fecha_inicio: '2026-13-01' })).toThrow(BadRequestException);
  });
});

