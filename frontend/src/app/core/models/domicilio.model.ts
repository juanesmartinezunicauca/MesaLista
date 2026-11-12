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
    id: 'zona-cercana-local',
    nombre: 'Zona Cercana (Cerca al local: Catay, Campanario, Santa Clara o cercano)',
    descripcion: 'Catay, Campanario, Santa Clara, Campamento, Ciudad Jardín o sectores aledaños al local',
    tarifa: 3000,
  },
  {
    id: 'zona-centro-comuneros',
    nombre: 'Zona Centro (Centro Histórico, Comuneros o aledaños)',
    descripcion: 'Centro Histórico, Los Comuneros, Los Hoyos, Modelo, Bolívar, Pomona o sectores aledaños',
    tarifa: 4000,
  },
  {
    id: 'zona-sur-esmeralda',
    nombre: 'Zona Sur (La Esmeralda, Lomas de Granada o cercano)',
    descripcion: 'La Esmeralda, Lomas de Granada, Chirimía, Alfonso López, Los Sauces, Pandiguando o sectores cercanos',
    tarifa: 6000,
  },
  {
    id: 'zona-norte-bellohorizonte',
    nombre: 'Zona Norte (Bello Horizonte, La Paz o cercano)',
    descripcion: 'Bello Horizonte, La Paz, Entre Pinos, Morinda, Pisojé, Torremolinos o sectores cercanos',
    tarifa: 7000,
  },
];
