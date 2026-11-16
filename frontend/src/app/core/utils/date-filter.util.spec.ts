import { formatearFechaLocal, resolverPresetRango } from './date-filter.util';

describe('date-filter.util', () => {
  const ref = new Date(2026, 10, 16, 14, 30, 0); // 16 nov 2026

  it('debe formatear fechas locales en YYYY-MM-DD', () => {
    expect(formatearFechaLocal(ref)).toBe('2026-11-16');
  });

  it('debe resolver presets hoy, ayer, 7dias, mes, mes_anterior y todos', () => {
    expect(resolverPresetRango('todos', ref)).toEqual({ fechaInicio: '', fechaFin: '' });
    expect(resolverPresetRango('hoy', ref)).toEqual({
      fechaInicio: '2026-11-16',
      fechaFin: '2026-11-16',
    });
    expect(resolverPresetRango('ayer', ref)).toEqual({
      fechaInicio: '2026-11-15',
      fechaFin: '2026-11-15',
    });
    expect(resolverPresetRango('7dias', ref)).toEqual({
      fechaInicio: '2026-11-10',
      fechaFin: '2026-11-16',
    });
    expect(resolverPresetRango('mes', ref)).toEqual({
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-16',
    });
    expect(resolverPresetRango('mes_anterior', ref)).toEqual({
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31',
    });
  });
});

