import { Injectable, computed, signal } from '@angular/core';
import { Producto } from '../../models/producto.model';

export interface CartItem {
  producto: Producto;
  cantidad: number;
  ingredientes_removidos?: string[];
  observacion?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CarritoService {
  private readonly CART_STORAGE_KEY = 'mesalista_cliente_carrito';

  // Signal reactivo del estado del carrito
  carrito = signal<CartItem[]>([]);

  // Totales computados reactivos
  totalItems = computed<number>(() =>
    this.carrito().reduce((sum, item) => sum + item.cantidad, 0)
  );

  totalPrecio = computed<number>(() =>
    this.carrito().reduce(
      (sum, item) => sum + item.cantidad * item.producto.precio_venta,
      0
    )
  );

  constructor() {
    this.recuperarCarrito();
  }

  /**
   * Agrega un producto al carrito. Si ya existe exactamente con los mismos
   * ingredientes removidos y observación, incrementa la cantidad.
   */
  agregarAlCarrito(
    producto: Producto,
    removidos: string[] = [],
    observacion?: string
  ): void {
    const items = [...this.carrito()];
    const removidosKey = (removidos || []).slice().sort().join('|');

    const index = items.findIndex((it) => {
      const itRemovidosKey = (it.ingredientes_removidos || []).slice().sort().join('|');
      return (
        it.producto.id_producto === producto.id_producto &&
        itRemovidosKey === removidosKey &&
        (it.observacion || '') === (observacion || '')
      );
    });

    if (index >= 0) {
      items[index] = {
        ...items[index],
        cantidad: items[index].cantidad + 1,
      };
    } else {
      items.push({
        producto,
        cantidad: 1,
        ingredientes_removidos: removidos && removidos.length > 0 ? removidos : undefined,
        observacion: observacion ? observacion.trim() : undefined,
      });
    }

    this.carrito.set(items);
    this.guardarCarrito();
  }

  /**
   * Incrementa la cantidad de un ítem existente en el carrito
   */
  incrementar(index: number): void {
    const items = [...this.carrito()];
    if (index >= 0 && index < items.length) {
      items[index] = {
        ...items[index],
        cantidad: items[index].cantidad + 1,
      };
      this.carrito.set(items);
      this.guardarCarrito();
    }
  }

  /**
   * Decrementa la cantidad de un ítem. Si llega a 0, lo elimina.
   */
  decrementar(index: number): void {
    const items = [...this.carrito()];
    if (index >= 0 && index < items.length) {
      if (items[index].cantidad > 1) {
        items[index] = {
          ...items[index],
          cantidad: items[index].cantidad - 1,
        };
      } else {
        items.splice(index, 1);
      }
      this.carrito.set(items);
      this.guardarCarrito();
    }
  }

  /**
   * Elimina un ítem directamente del carrito
   */
  eliminar(index: number): void {
    const items = [...this.carrito()];
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      this.carrito.set(items);
      this.guardarCarrito();
    }
  }

  /**
   * Actualiza la personalización (ingredientes removidos y notas) de un ítem específico en el carrito
   */
  actualizarPersonalizacion(
    index: number,
    removidos: string[],
    observacion?: string
  ): void {
    const items = [...this.carrito()];
    if (index >= 0 && index < items.length) {
      items[index] = {
        ...items[index],
        ingredientes_removidos: removidos && removidos.length > 0 ? removidos : undefined,
        observacion: observacion && observacion.trim().length > 0 ? observacion.trim() : undefined,
      };
      this.carrito.set(items);
      this.guardarCarrito();
    }
  }

  /**
   * Vacía completamente los productos del carrito
   */
  vaciarCarrito(): void {
    this.carrito.set([]);
    try {
      localStorage.removeItem(this.CART_STORAGE_KEY);
    } catch {}
  }

  /**
   * Persiste el carrito en localStorage
   */
  private guardarCarrito(): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(this.carrito()));
    } catch {}
  }

  /**
   * Recupera el carrito persistido al cargar la aplicación
   */
  private recuperarCarrito(): void {
    try {
      const data = localStorage.getItem(this.CART_STORAGE_KEY);
      if (data) {
        const items = JSON.parse(data) as CartItem[];
        if (Array.isArray(items)) {
          this.carrito.set(items);
        }
      }
    } catch {}
  }
}
