import { Cliente } from './cliente.model';
import { Pago } from './pago.model';
import { Pedido } from './pedido.model';

export interface Factura {
  id_venta: number;
  id_mesa?: number | null;
  id_cliente?: number | null;
  id_usuario: number;
  id_caja: number;
  valor: number;
  propina: number;
  valor_total: number;
  fecha_hora: Date | string;
  observacion?: string | null;
  pedidos?: Pedido[];
  pagos?: Pago[];
  cliente?: Cliente;
}
