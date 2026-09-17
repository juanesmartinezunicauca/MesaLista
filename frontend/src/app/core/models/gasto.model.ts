export interface TipoGasto {
  id_tipo_gasto: number;
  nombre: string;
  estado?: boolean;
}

export interface Gasto {
  id_gasto: number;
  id_tipo_gasto: number;
  id_medio_pago: number;
  id_caja: number;
  id_usuario: number;
  total: number;
  fecha_hora: Date | string;
  descripcion: string;
  observacion?: string | null;
  tipoGasto?: TipoGasto;
}
