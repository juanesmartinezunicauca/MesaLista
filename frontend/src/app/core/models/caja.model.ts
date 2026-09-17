export type EstadoCaja = 'abierta' | 'cerrada';

export interface Caja {
  id_caja: number;
  id_usuario_apertura: number;
  id_usuario_cierre?: number | null;
  fecha_apertura: Date | string;
  fecha_cierre?: Date | string | null;
  valor_inicial: number;
  valor_final_teorico?: number | null;
  valor_final_fisico?: number | null;
  diferencia?: number | null;
  estado: EstadoCaja;
}
