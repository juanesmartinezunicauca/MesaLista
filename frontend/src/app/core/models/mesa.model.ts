import { ItemPedido } from './item-pedido.model';
import { Pedido } from './pedido.model';

export type EstadoMesaBD = 'libre' | 'ocupada';

// Estados visuales diferenciados en la interfaz gráfica:
// - 'libre': Verde (en BD libre, sin pedidos)
// - 'en_pedido': Amarillo (en BD libre, con borrador de pedido local activo)
// - 'ocupada': Rojo (en BD ocupada, con al menos un pedido enviado a cocina)
export type EstadoVisualMesa = 'libre' | 'en_pedido' | 'ocupada';

export interface Mesa {
  id_mesa: number;
  numero: number;
  estado_bd: EstadoMesaBD;
  estado_visual: EstadoVisualMesa;
  mesero_actual?: string;
  fecha_apertura?: Date | string;
  pedidos: Pedido[];
  borrador_local: ItemPedido[];
  total_acumulado: number;
}

export interface MetricasSalondeMesas {
  total: number;
  libres: number;
  enPedido: number;
  ocupadas: number;
  porcentajeOcupacion: number;
}
