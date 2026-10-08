import { Cliente } from './cliente.model';
import { EstadoPedido, TipoPedido } from './pedido.model';

export type EtapaOperativaDomicilio = 'Pendiente' | 'En Preparación' | 'En Reparto' | 'Entregado' | 'Cancelado';

export interface PedidoDomicilioItem {
  id_item?: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  ingredientes_removidos?: string | null;
  observacion?: string | null;
  producto?: {
    id_producto: number;
    nombre: string;
    categoria: string;
    precio_venta: number;
    disponible: boolean;
  };
}

export interface Domicilio {
  id_pedido: number;
  id_factura?: number | null;
  id_cliente: number;
  id_usuario: number;
  numero_pedido: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  etapaOperativa: EtapaOperativaDomicilio;
  totalCalculado: number;
  fecha_hora: string | Date;
  observacion?: string | null;
  cliente: Cliente;
  items: PedidoDomicilioItem[];
  repartidor?: {
    nombre: string;
    telefono: string;
  } | null;
  metodo_pago?: string;
  factura?: any;
  usuario?: {
    id_usuario: number;
    nombre: string;
    rol: string;
  };
}

export interface CreateDomicilioPayload {
  cliente: {
    nombre: string;
    telefono: string;
    direccion: string;
  };
  items: {
    id_producto: number;
    cantidad: number;
    ingredientes_removidos?: string;
    observacion?: string;
  }[];
  observacion?: string;
  metodo_pago?: string;
}
