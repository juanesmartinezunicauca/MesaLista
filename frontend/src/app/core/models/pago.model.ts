export interface MedioPago {
  id_medio_pago: number;
  nombre: string;
  estado?: boolean;
}

export interface Pago {
  id_pago: number;
  id_venta: number;
  id_medio_pago: number;
  monto: number;
  fecha_hora: Date | string;
  medioPago?: MedioPago;
}
