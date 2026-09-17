// =========================================================================
// MesaLista - Modelos para Épica HE-02 (Mesas y Pedidos)
// Integrados directamente con los Modelos Canónicos de Dominio (@core/models)
// =========================================================================

import {
  EstadoMesaBD,
  EstadoVisualMesa,
  ItemPersonalizacion,
  ItemPedido,
  Pedido,
  Mesa,
  MetricasSalondeMesas,
  Producto
} from '@core/models';

export type { EstadoMesaBD, EstadoVisualMesa, ItemPersonalizacion, ItemPedido, MetricasSalondeMesas, Mesa };

// Alias de conveniencia para tipado de pedidos en el contexto de mesas
export type PedidoMesa = Pedido;

// Alias de producto en catálogo para selección rápida
export type ProductoCatalogo = Pick<
  Producto,
  'id_producto' | 'nombre' | 'categoria' | 'precio_venta' | 'disponible' | 'ingredientes_removibles'
>;
