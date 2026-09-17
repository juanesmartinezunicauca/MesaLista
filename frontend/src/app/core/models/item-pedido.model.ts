export interface ItemPedido {
  id_item: string | number;
  id_pedido?: number;
  id_producto: number;
  nombre?: string;
  categoria?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  ingredientes_removibles?: string[];
  ingredientes_removidos?: string[];
  observacion?: string;
}

export interface ItemPersonalizacion {
  ingredientes_removibles: string[];
  ingredientes_removidos: string[];
  observacion: string;
}
