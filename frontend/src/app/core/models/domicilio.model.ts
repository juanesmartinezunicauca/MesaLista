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
  id_cliente?: number | null;
  id_usuario: number;
  numero_pedido: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  etapaOperativa: EtapaOperativaDomicilio;
  totalCalculado: number;
  costo_envio?: number;
  zona_nombre?: string;
  subtotalProductos?: number;
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
    email?: string;
  };
  items: {
    id_producto: number;
    cantidad: number;
    ingredientes_removidos?: string;
    observacion?: string;
  }[];
  observacion?: string;
  metodo_pago?: string;
  costo_envio?: number;
  zona_entrega?: string;
}

export interface EstadoServicioDomicilio {
  activo: boolean;
  cajaAbierta: boolean;
  recibiendoDomicilios: boolean;
  motivo?: string;
}

export interface Domiciliario {
  id: string;
  nombre: string;
  telefono: string;
  vehiculo?: string;
  activo?: boolean;
}

export interface ZonaTarifaPopayan {
  id: string;
  nombre: string;
  descripcion: string;
  tarifa: number;
}

export const ZONAS_DOMICILIO_POPAYAN: ZonaTarifaPopayan[] = [
  {
    id: 'zona-comuna-1',
    nombre: 'Zona 1: Comuna 1 y Cercanías',
    descripcion: 'Catay, Campanario, Ciudad Jardín, Campamento, La Floresta',
    tarifa: 3000,
  },
  {
    id: 'zona-centro-aledanas',
    nombre: 'Zona 2: Aledañas a Comuna 1 y Centro',
    descripcion: 'Los Hoyos, Yambitará, Pomona, Centro Histórico, Caldas, Modelo',
    tarifa: 4000,
  },
  {
    id: 'zona-sur',
    nombre: 'Zona 3: Sur de Popayán',
    descripcion: 'Lomas de Granada, Chirimía, Alfonso López, Los Sauces, Variante Sur, Mi Bohío',
    tarifa: 6000,
  },
  {
    id: 'zona-norte',
    nombre: 'Zona 4: Zona Norte',
    descripcion: 'La Paz, Bello Horizonte, Entre Pinos, Morinda, Pisojé, Variante Norte',
    tarifa: 7000,
  },
];
