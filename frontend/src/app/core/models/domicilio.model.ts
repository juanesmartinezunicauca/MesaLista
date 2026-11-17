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

export interface BarrioPopayan {
  nombre: string;
  zonaId:
    | 'zona-cercana-local'
    | 'zona-centro-comuneros'
    | 'zona-sur-esmeralda'
    | 'zona-norte-bellohorizonte';
}

export const ZONAS_DOMICILIO_POPAYAN: ZonaTarifaPopayan[] = [
  {
    id: 'zona-cercana-local',
    nombre: 'Zona Cercana',
    descripcion: 'Catay, Campanario, Santa Clara, Campamento, Ciudad Jardín o sectores aledaños al local',
    tarifa: 3000,
  },
  {
    id: 'zona-centro-comuneros',
    nombre: 'Zona Centro',
    descripcion: 'Centro Histórico, Los Comuneros, Los Hoyos, Modelo, Bolívar, Pomona o sectores aledaños',
    tarifa: 4000,
  },
  {
    id: 'zona-sur-esmeralda',
    nombre: 'Zona Sur',
    descripcion: 'La Esmeralda, Lomas de Granada, Chirimía, Alfonso López, Los Sauces, Pandiguando o sectores cercanos',
    tarifa: 6000,
  },
  {
    id: 'zona-norte-bellohorizonte',
    nombre: 'Zona Norte',
    descripcion: 'Bello Horizonte, La Paz, Entre Pinos, Morinda, Pisojé, Torremolinos o sectores cercanos',
    tarifa: 7000,
  },
];

const BARRIOS_POR_ZONA_POPAYAN: Record<BarrioPopayan['zonaId'], string[]> = {
  'zona-cercana-local': [
    'Campamento',
    'Campanario',
    'Canterbury',
    'Catay',
    'Champagnat',
    'Ciudad Jardín',
    'El Recuerdo',
    'Fucha',
    'Guayacanes',
    'La Estancia',
    'La Ladera',
    'La Lotería',
    'Loma Linda',
    'Palacé',
    'Pinares',
    'Portales del Norte',
    'Prados del Norte',
    'Quintas de José Miguel',
    'Rincón de la Estancia',
    'San Ignacio',
    'Santa Clara',
    'Villa del Norte',
    'Villa Paula',
  ],
  'zona-centro-comuneros': [
    'Américas',
    'Avelino Ull',
    'Belalcázar',
    'Berlín',
    'Bolívar',
    'Caldas',
    'Centro Histórico',
    'El Cadillal',
    'El Empedrado',
    'El Lago',
    'El Liceo',
    'El Pajonal',
    'El Plateado',
    'El Prado',
    'Favidi',
    'La Alameda',
    'La Floresta',
    'La Pamba',
    'Las Palmas',
    'Las Tres Cruces',
    'Los Álamos',
    'Los Braceros',
    'Los Comuneros',
    'Los Hoyos',
    'María Oriente',
    'Modelo',
    'Moscopán',
    'Pomona',
    'Pueblillo',
    'Puerta de Hierro',
    'San Camilo',
    'San Rafael',
    'Santa Inés',
    'Siglo XXI',
    'Suizo',
    'Tequendama',
    'Ucrania',
    'Valencia',
    'Vásquez Cobo',
    'Yanaconas',
  ],
  'zona-sur-esmeralda': [
    '2 de Abril',
    '31 de Marzo',
    'Alfonso López',
    'Calicanto',
    'Camilo Torres',
    'Chapinero',
    'Chirimía',
    'Colgate Palmolive',
    'El Bolívar Sur',
    'El Deportista',
    'El Limonar',
    'El Mirador',
    'Jorge Eliécer Gaitán',
    'José María Obando',
    'Junín',
    'La Esmeralda',
    'La Independencia',
    'La María Occidente',
    'La Paz Sur',
    'Las Ferias',
    'Las Vegas',
    'Libertadores',
    'Lomas de Granada',
    'Los Campos',
    'Los Sauces',
    'Madres Solteras',
    'Mis Ranchitos',
    'Nazareth',
    'Nuevo Hogar',
    'Nuevo País',
    'Panamericano',
    'Pandiguando',
    'Perpetuo Socorro',
    'Primero de Mayo',
    'Retiro Alto',
    'Retiro Bajo',
    'San José',
    'Santa Librada',
    'Sindical',
    'Solidaridad',
    'Tomás Cipriano de Mosquera',
    'Valparaíso',
  ],
  'zona-norte-bellohorizonte': [
    'Antonio Nariño',
    'Asturias',
    'Balcón del Norte',
    'Bella Vista',
    'Bello Horizonte',
    'Bosques del Norte',
    'Cajete',
    'Canales de Brujas',
    'Chamizal',
    'Cruz Roja',
    'Destechados del Norte',
    'El Bambú',
    'El Ortigal',
    'El Placer',
    'El Tablazo',
    'El Uvo',
    'Entre Pinos',
    'González',
    'Gran Bretaña',
    'Julumito',
    'La Aldea',
    'La Arboleda',
    'La Paz Norte',
    'La Primavera',
    'La Sombrilla',
    'La Violeta',
    'Las Guacas',
    'Lomas de San Rafael',
    'Los Ángeles',
    'Los Cámbulos',
    'Luna Blanca',
    'María Paz',
    'Matamoros',
    'Minuto de Dios',
    'Monte Rosales',
    'Morinda',
    'Nueva Alianza',
    'Nuevo Popayán',
    'Pino Pardo',
    'Pisojé',
    'Pisojé Alto',
    'Pisojé Bajo',
    'Pontevedra',
    'Puelenje',
    'Rincón de Comfacauca',
    'Rincón del Río',
    'San Eduardo',
    'San Fernando',
    'Santa Rosa',
    'Torremolinos',
    'Valle del Ortigal',
    'Vereda González',
    'Villa Claudia',
    'Villa del Viento',
    'Villa Melisa',
    'Villa Occidente',
    'Zuldemaida',
  ],
};

function normalizarTextoPopayan(valor?: string | null): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const BARRIOS_POPAYAN: BarrioPopayan[] = (
  Object.entries(BARRIOS_POR_ZONA_POPAYAN) as [BarrioPopayan['zonaId'], string[]][]
)
  .flatMap(([zonaId, nombres]) => nombres.map((nombre) => ({ nombre, zonaId })))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

const BARRIOS_ORDENADOS_POR_LONGITUD = [...BARRIOS_POPAYAN].sort(
  (a, b) => b.nombre.length - a.nombre.length,
);

/**
 * Detecta un barrio de Popayán dentro de un nombre de barrio o dirección escrita por el usuario.
 */
export function detectarBarrioEnTexto(texto?: string | null): BarrioPopayan | null {
  const norm = normalizarTextoPopayan(texto);
  if (!norm) return null;

  const exacto = BARRIOS_POPAYAN.find((b) => normalizarTextoPopayan(b.nombre) === norm);
  if (exacto) return exacto;

  for (const b of BARRIOS_ORDENADOS_POR_LONGITUD) {
    const bNorm = normalizarTextoPopayan(b.nombre);
    if (bNorm.length >= 4 && norm.includes(bNorm)) {
      return b;
    }
  }
  return null;
}

/**
 * Determina automáticamente la zona y tarifa de domicilio en Popayán a partir del barrio seleccionado o la dirección.
 */
export function determinarZonaPorBarrio(
  barrioOZona?: string | null,
  direccionRespaldo?: string | null,
): ZonaTarifaPopayan {
  const porBarrio = detectarBarrioEnTexto(barrioOZona) || detectarBarrioEnTexto(direccionRespaldo);
  if (porBarrio) {
    return (
      ZONAS_DOMICILIO_POPAYAN.find((z) => z.id === porBarrio.zonaId) || ZONAS_DOMICILIO_POPAYAN[0]
    );
  }

  const norm = normalizarTextoPopayan(barrioOZona);
  if (norm) {
    const porIdONombre = ZONAS_DOMICILIO_POPAYAN.find(
      (z) => z.id === norm || normalizarTextoPopayan(z.nombre) === norm || norm.includes(normalizarTextoPopayan(z.nombre)),
    );
    if (porIdONombre) return porIdONombre;
  }

  return ZONAS_DOMICILIO_POPAYAN[0];
}
