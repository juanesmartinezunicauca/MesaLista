export interface Producto {
  id_producto: number;
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo: number;
  ingredientes_removibles: string[];
  cantidad_inventario: number;
  controla_inventario: boolean;
  disponible: boolean;
}

export type TipoAjusteInventario = 'Entrada' | 'Merma' | 'Arqueo';

export interface AjusteInventario {
  id_ajuste: number;
  id_producto: number;
  id_usuario: number;
  tipo_ajuste: TipoAjusteInventario;
  cantidad: number;
  motivo: string;
  fecha_hora: Date | string;
}
