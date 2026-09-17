import { ItemPedido } from './item-pedido.model';

export type TipoPedido = 'salon' | 'domicilio';
export type EstadoPedido = 'enviada' | 'cerrada' | 'cancelada';

export interface Pedido {
  id_pedido: number;
  id_factura?: number | null;
  id_mesa?: number | null;
  id_cliente?: number | null;
  id_usuario?: number;
  numero_pedido: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  fecha_hora: Date | string;
  observacion?: string;
  mesero?: string;
  items: ItemPedido[];
  subtotal: number;
}
