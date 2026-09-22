import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EstadoMesaBD,
  EstadoVisualMesa,
  ItemPedido,
  ItemPersonalizacion,
  Mesa,
  MetricasSalondeMesas,
  PedidoMesa,
  ProductoCatalogo,
} from '../models/mesa.model';
import { MesasApiService, BackendMesa } from '../../../core/services/api/mesas-api.service';
import { PedidosApiService, CreatePedidoPayload } from '../../../core/services/api/pedidos-api.service';
import { CatalogoApiService } from '../../../core/services/api/catalogo-api.service';
import { AuthService } from '../../../core/services/auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class MesasService {
  private mesasApi = inject(MesasApiService);
  private pedidosApi = inject(PedidosApiService);
  private catalogoApi = inject(CatalogoApiService);
  private authService = inject(AuthService);

  // Estado de conexión / sincronización con backend
  isSyncing = signal<boolean>(false);
  syncError = signal<string | null>(null);

  // TTL para evitar recargas innecesarias del catálogo (30 segundos)
  private _ultimaCargaCatalogo = 0;
  private readonly CATALOGO_TTL_MS = 30_000;

  // Catálogo de productos disponibles para pedidos (cargado dinámicamente desde el backend)
  catalogoProductos = signal<ProductoCatalogo[]>([]);

  // Estado reactivo de las mesas (cargado dinámicamente desde el backend)
  private mesasSignal = signal<Mesa[]>([]);

  // Filtros y búsquedas
  filtroEstado = signal<'todas' | 'libre' | 'en_pedido' | 'ocupada'>('todas');
  busquedaNumero = signal<string>('');
  mesaSeleccionada = signal<Mesa | null>(null);

  // Lista pública de mesas
  mesas = this.mesasSignal.asReadonly();

  // Métricas reactivas calculadas
  metricas = computed<MetricasSalondeMesas>(() => {
    const list = this.mesasSignal();
    const total = list.length;
    const libres = list.filter((m) => m.estado_visual === 'libre').length;
    const enPedido = list.filter((m) => m.estado_visual === 'en_pedido').length;
    const ocupadas = list.filter((m) => m.estado_visual === 'ocupada').length;
    const porcentajeOcupacion = total > 0 ? Math.round(((ocupadas + enPedido) / total) * 100) : 0;

    return { total, libres, enPedido, ocupadas, porcentajeOcupacion };
  });

  // Lista de mesas filtradas reactivamente
  mesasFiltradas = computed<Mesa[]>(() => {
    const list = this.mesasSignal();
    const filtro = this.filtroEstado();
    const search = this.busquedaNumero().trim();

    return list.filter((mesa) => {
      const coincideFiltro = filtro === 'todas' || mesa.estado_visual === filtro;
      const coincideBusqueda = !search || mesa.numero.toString().includes(search);
      return coincideFiltro && coincideBusqueda;
    });
  });

  constructor() {
    // La carga inicial se dispara desde PlanoMesasComponent.ngOnInit()
    // para evitar una doble carga al montar el servicio y el componente.
  }

  /**
   * Carga inicial o recarga desde la API de backend
   */
  cargarDatosDesdeBackend(): void {
    this.cargarCatalogo();
    this.cargarMesas();
  }

  /**
   * Carga el catálogo de productos desde el backend.
   * Incorpora un TTL de 30s para evitar llamadas excesivas cuando múltiples
   * puntos de la UI lo invocan en cascada (clickMesa, borrador ngOnInit, etc.).
   */
  cargarCatalogo(): void {
    const ahora = Date.now();
    if (ahora - this._ultimaCargaCatalogo < this.CATALOGO_TTL_MS) return;
    this._ultimaCargaCatalogo = ahora;

    this.catalogoApi.obtenerProductos().subscribe({
      next: (prods) => {
        if (prods) {
          const catalogoMapeado: ProductoCatalogo[] = prods.map((p) => ({
            id_producto: p.id_producto,
            nombre: p.nombre,
            categoria: p.categoria,
            precio_venta: p.precio_venta,
            disponible: p.disponible,
            ingredientes_removibles: p.ingredientes_removibles || [],
          }));
          this.catalogoProductos.set(catalogoMapeado);
        }
      },
      error: (err) => {
        console.warn('Backend no disponible para catálogo.', err);
      },
    });
  }

  /**
   * Carga la lista de mesas y sus comandas activas desde el backend
   */
  cargarMesas(): void {
    this.isSyncing.set(true);
    this.syncError.set(null);

    this.mesasApi.obtenerTodas().subscribe({
      next: (mesasBackend) => {
        this.isSyncing.set(false);
        if (mesasBackend) {
          // Conservar borradores locales activos si existían previamente
          const borradoresPrevios = new Map<number, ItemPedido[]>();
          for (const m of this.mesasSignal()) {
            if (m.borrador_local.length > 0) {
              borradoresPrevios.set(m.numero, m.borrador_local);
            }
          }

          const mesasMapeadas: Mesa[] = mesasBackend.map((bm) => {
            const borrador = borradoresPrevios.get(bm.numero) || [];

            const pedidosMapeados: PedidoMesa[] = (bm.pedidos || []).map((p) => {
              const items: ItemPedido[] = (p.items || []).map((it) => {
                const precio = Number(it.precio_unitario);
                let ingRemovidos: string[] = [];
                if (typeof it.ingredientes_removidos === 'string' && it.ingredientes_removidos.trim()) {
                  ingRemovidos = it.ingredientes_removidos.split(',').map((s) => s.trim());
                }

                return {
                  id_item: it.id_item,
                  id_producto: it.id_producto,
                  nombre: it.producto?.nombre || `Producto #${it.id_producto}`,
                  categoria: it.producto?.categoria || 'General',
                  cantidad: it.cantidad,
                  precio_unitario: precio,
                  subtotal: precio * it.cantidad,
                  ingredientes_removidos: ingRemovidos,
                  observacion: it.observacion || undefined,
                };
              });

              return {
                id_pedido: p.id_pedido,
                numero_pedido: p.numero_pedido,
                tipo: p.tipo,
                estado: p.estado,
                fecha_hora: typeof p.fecha_hora === 'string'
                  ? p.fecha_hora
                  : new Date(p.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                mesero: p.usuario?.nombre || 'Mesero Activo',
                observacion: p.observacion || undefined,
                items,
                subtotal: items.reduce((acc, i) => acc + i.subtotal, 0),
              };
            });

            // Determinar estado visual
            let estadoVisual: EstadoVisualMesa = 'libre';
            if (bm.estado === 'ocupada' || pedidosMapeados.length > 0) {
              estadoVisual = 'ocupada';
            } else if (borrador.length > 0) {
              estadoVisual = 'en_pedido';
            }

            const total = this.calcularTotalMesa(pedidosMapeados, borrador);

            // Extraer meseros únicos que atendieron las comandas de esta mesa
            const meserosUnicos = Array.from(
              new Set(pedidosMapeados.map((p) => p.mesero).filter(Boolean))
            );
            const meseroActual = meserosUnicos.length > 0 ? meserosUnicos.join(', ') : undefined;

            return {
              id_mesa: bm.id_mesa,
              numero: bm.numero,
              estado_bd: bm.estado as EstadoMesaBD,
              estado_visual: estadoVisual,
              mesero_actual: meseroActual,
              pedidos: pedidosMapeados,
              borrador_local: borrador,
              total_acumulado: total,
            };
          });

          this.mesasSignal.set(mesasMapeadas);
        }
      },
      error: (err) => {
        this.isSyncing.set(false);
        this.syncError.set('Modo fuera de línea: no se pudo conectar con el backend.');
        console.warn('Backend no disponible para mesas.', err);
      },
    });
  }

  // --- MÉTODOS DE NEGOCIO ---

  seleccionarMesa(mesa: Mesa): void {
    this.mesaSeleccionada.set(mesa);
  }

  limpiarSeleccion(): void {
    this.mesaSeleccionada.set(null);
  }

  /**
   * Configurar/Agregar nueva mesa
   */
  crearMesa(numero: number): { exito: boolean; mensaje: string } {
    if (numero <= 0) {
      return { exito: false, mensaje: 'El número de mesa debe ser mayor a 0.' };
    }

    const existe = this.mesasSignal().some((m) => m.numero === numero);
    if (existe) {
      return { exito: false, mensaje: `La mesa #${numero} ya se encuentra registrada.` };
    }

    const nuevaMesa: Mesa = {
      id_mesa: Date.now() + numero,
      numero,
      estado_bd: 'libre',
      estado_visual: 'libre',
      pedidos: [],
      borrador_local: [],
      total_acumulado: 0,
    };

    this.mesasSignal.update((list) => [...list, nuevaMesa].sort((a, b) => a.numero - b.numero));

    // Persistir en backend
    this.mesasApi.crear(numero).subscribe({
      next: (mesaBackend) => {
        this.mesasSignal.update((list) =>
          list.map((m) => (m.numero === numero ? { ...m, id_mesa: mesaBackend.id_mesa } : m))
        );
      },
      error: (err) => {
        console.warn('Mesa creada localmente. Error al persistir en backend:', err);
      },
    });

    return { exito: true, mensaje: `Mesa #${numero} creada exitosamente.` };
  }

  /**
   * Eliminar mesa (solo si está libre y sin pedidos pendientes)
   */
  eliminarMesa(id_mesa: number): { exito: boolean; mensaje: string } {
    const mesa = this.mesasSignal().find((m) => m.id_mesa === id_mesa);
    if (!mesa) {
      return { exito: false, mensaje: 'Mesa no encontrada.' };
    }

    if (mesa.estado_visual === 'ocupada' || mesa.pedidos.length > 0) {
      return {
        exito: false,
        mensaje: 'Bloqueado: La mesa tiene pedidos activos pendientes de facturación.',
      };
    }

    this.mesasSignal.update((list) => list.filter((m) => m.id_mesa !== id_mesa));
    if (this.mesaSeleccionada()?.id_mesa === id_mesa) {
      this.limpiarSeleccion();
    }

    // Persistir eliminación en backend
    this.mesasApi.eliminar(id_mesa).subscribe({
      error: (err) => console.warn('Error al eliminar mesa en backend:', err),
    });

    return { exito: true, mensaje: `Mesa #${mesa.numero} eliminada.` };
  }

  /**
   * Agregar producto al borrador de pedido de la mesa
   * Transiciona la mesa a estado 'en_pedido' (Amarillo) en la interfaz local
   */
  agregarItemBorrador(
    id_mesa: number,
    producto: ProductoCatalogo,
    personalizacion?: ItemPersonalizacion
  ): void {
    this.mesasSignal.update((list) =>
      list.map((m) => {
        if (m.id_mesa !== id_mesa) return m;

        const nuevoItem: ItemPedido = {
          id_item: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          subtotal: producto.precio_venta,
          ingredientes_removibles: producto.ingredientes_removibles,
          ingredientes_removidos: personalizacion?.ingredientes_removidos || [],
          observacion: personalizacion?.observacion || '',
        };

        const nuevoBorrador = [...m.borrador_local, nuevoItem];
        const nuevoTotal = this.calcularTotalMesa(m.pedidos, nuevoBorrador);

        const nuevoEstadoVisual: EstadoVisualMesa =
          m.estado_visual === 'ocupada' ? 'ocupada' : 'en_pedido';

        const mesaActualizada: Mesa = {
          ...m,
          estado_visual: nuevoEstadoVisual,
          borrador_local: nuevoBorrador,
          total_acumulado: nuevoTotal,
        };

        if (this.mesaSeleccionada()?.id_mesa === id_mesa) {
          this.mesaSeleccionada.set(mesaActualizada);
        }

        return mesaActualizada;
      })
    );
  }

  /**
   * Modificar cantidad (+/-) de un ítem en borrador
   */
  modificarCantidadBorrador(id_mesa: number, id_item: string | number, delta: number): void {
    this.mesasSignal.update((list) =>
      list.map((m) => {
        if (m.id_mesa !== id_mesa) return m;

        let nuevoBorrador = m.borrador_local
          .map((item) => {
            if (item.id_item !== id_item) return item;
            const nuevaCantidad = item.cantidad + delta;
            return {
              ...item,
              cantidad: nuevaCantidad,
              subtotal: nuevaCantidad * item.precio_unitario,
            };
          })
          .filter((item) => item.cantidad > 0);

        const nuevoTotal = this.calcularTotalMesa(m.pedidos, nuevoBorrador);

        let nuevoEstadoVisual: EstadoVisualMesa = m.estado_visual;
        if (nuevoBorrador.length === 0 && m.pedidos.length === 0) {
          nuevoEstadoVisual = 'libre';
        }

        const mesaActualizada: Mesa = {
          ...m,
          estado_visual: nuevoEstadoVisual,
          borrador_local: nuevoBorrador,
          total_acumulado: nuevoTotal,
        };

        if (this.mesaSeleccionada()?.id_mesa === id_mesa) {
          this.mesaSeleccionada.set(mesaActualizada);
        }

        return mesaActualizada;
      })
    );
  }

  /**
   * Enviar Pedido a Cocina
   * - Registra comanda con congelamiento de precios en backend
   * - Transiciona la mesa a 'ocupada'
   */
  enviarPedidoACocina(id_mesa: number, observacion?: string): { exito: boolean; mensaje: string } {
    let resultado = { exito: false, mensaje: '' };

    const mesaActual = this.mesasSignal().find((m) => m.id_mesa === id_mesa);
    if (!mesaActual || mesaActual.borrador_local.length === 0) {
      return { exito: false, mensaje: 'El borrador del pedido está vacío.' };
    }

    const itemsBorrador = [...mesaActual.borrador_local];
    const numeroPedido = mesaActual.pedidos.length + 1;
    const subtotalPedido = itemsBorrador.reduce((acc, item) => acc + item.subtotal, 0);

    const usuarioSesion = this.authService.currentUser();
    const nombreMesero = usuarioSesion?.nombre || mesaActual.mesero_actual || 'Mesero Activo';

    const nuevoPedido: PedidoMesa = {
      id_pedido: Date.now(),
      numero_pedido: numeroPedido,
      tipo: 'salon',
      estado: 'enviada',
      fecha_hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mesero: nombreMesero,
      observacion: observacion || '',
      items: itemsBorrador,
      subtotal: subtotalPedido,
    };

    const nuevosPedidos = [...mesaActual.pedidos, nuevoPedido];
    const nuevoTotal = this.calcularTotalMesa(nuevosPedidos, []);

    const meserosUnicos = Array.from(
      new Set(nuevosPedidos.map((p) => p.mesero).filter(Boolean))
    );
    const meseroActual = meserosUnicos.join(', ');

    const mesaActualizada: Mesa = {
      ...mesaActual,
      estado_bd: 'ocupada',
      estado_visual: 'ocupada',
      mesero_actual: meseroActual,
      pedidos: nuevosPedidos,
      borrador_local: [],
      total_acumulado: nuevoTotal,
      fecha_apertura: mesaActual.fecha_apertura || 'Hace un instante',
    };

    this.mesasSignal.update((list) =>
      list.map((m) => (m.id_mesa === id_mesa ? mesaActualizada : m))
    );

    if (this.mesaSeleccionada()?.id_mesa === id_mesa) {
      this.mesaSeleccionada.set(mesaActualizada);
    }

    // Persistencia en backend
    const payload: CreatePedidoPayload = {
      tipo: 'salon',
      id_mesa,
      observacion: observacion || undefined,
      items: itemsBorrador.map((i) => ({
        id_producto: i.id_producto,
        cantidad: i.cantidad,
        ingredientes_removidos:
          i.ingredientes_removidos && i.ingredientes_removidos.length > 0
            ? i.ingredientes_removidos.join(', ')
            : undefined,
        observacion: i.observacion || undefined,
      })),
    };

    this.pedidosApi.crearPedido(payload).subscribe({
      next: (pedidoCreadoBackend) => {
        this.mesasSignal.update((list) =>
          list.map((m) => {
            if (m.id_mesa !== id_mesa) return m;
            const pedidosActualizados = m.pedidos.map((p) =>
              p.id_pedido === nuevoPedido.id_pedido
                ? {
                    ...p,
                    id_pedido: pedidoCreadoBackend.id_pedido,
                    numero_pedido: pedidoCreadoBackend.numero_pedido,
                  }
                : p
            );
            return { ...m, pedidos: pedidosActualizados };
          })
        );
      },
      error: (err) => {
        console.warn('El pedido se despachó localmente. Error de sincronización con backend:', err);
      },
    });

    resultado = {
      exito: true,
      mensaje: `Pedido #${numeroPedido} enviado con éxito a cocina. Mesa #${mesaActual.numero} marcada como Ocupada.`,
    };

    return resultado;
  }

  /**
   * Transferir pedidos de una mesa a otra
   */
  transferirMesa(id_origen: number, id_destino: number): { exito: boolean; mensaje: string } {
    const list = this.mesasSignal();
    const origen = list.find((m) => m.id_mesa === id_origen);
    const destino = list.find((m) => m.id_mesa === id_destino);

    if (!origen || !destino) {
      return { exito: false, mensaje: 'Mesas no encontradas.' };
    }

    if (origen.pedidos.length === 0 && origen.borrador_local.length === 0) {
      return { exito: false, mensaje: 'La mesa de origen no tiene pedidos para transferir.' };
    }

    this.mesasSignal.update((prevList) =>
      prevList.map((m) => {
        if (m.id_mesa === id_origen) {
          return {
            ...m,
            estado_bd: 'libre',
            estado_visual: 'libre',
            pedidos: [],
            borrador_local: [],
            total_acumulado: 0,
            mesero_actual: undefined,
            fecha_apertura: undefined,
          };
        }

        if (m.id_mesa === id_destino) {
          const pedidosConsolidados = [...m.pedidos, ...origen.pedidos];
          const borradorConsolidado = [...m.borrador_local, ...origen.borrador_local];
          const nuevoTotal = this.calcularTotalMesa(pedidosConsolidados, borradorConsolidado);
          return {
            ...m,
            estado_bd: 'ocupada',
            estado_visual: 'ocupada',
            mesero_actual: m.mesero_actual || origen.mesero_actual,
            pedidos: pedidosConsolidados,
            borrador_local: borradorConsolidado,
            total_acumulado: nuevoTotal,
          };
        }

        return m;
      })
    );

    // Actualizar mesa seleccionada si correspondía a la mesa transferida
    if (this.mesaSeleccionada()?.id_mesa === id_origen) {
      const destinoActualizado = this.mesasSignal().find((m) => m.id_mesa === id_destino);
      if (destinoActualizado) {
        this.mesaSeleccionada.set(destinoActualizado);
      }
    }

    // Persistir transferencia atómica de comandas en backend
    this.mesasApi.transferir(id_origen, id_destino).subscribe({
      next: () => {
        this.cargarMesas();
      },
      error: (err) => {
        console.warn('Error al transferir mesa en backend:', err);
      },
    });

    return {
      exito: true,
      mensaje: `Pedidos transferidos de Mesa #${origen.numero} a Mesa #${destino.numero} con éxito.`,
    };
  }

  /**
   * Liberación de mesa tras facturación y pago
   */
  liberarMesa(id_mesa: number): void {
    this.mesasSignal.update((list) =>
      list.map((m) => {
        if (m.id_mesa !== id_mesa) return m;

        const mesaLiberada: Mesa = {
          ...m,
          estado_bd: 'libre',
          estado_visual: 'libre',
          pedidos: [],
          borrador_local: [],
          total_acumulado: 0,
          mesero_actual: undefined,
          fecha_apertura: undefined,
        };

        if (this.mesaSeleccionada()?.id_mesa === id_mesa) {
          this.mesaSeleccionada.set(mesaLiberada);
        }

        return mesaLiberada;
      })
    );

    // Sincronizar liberación con el backend
    this.mesasApi.cambiarEstado(id_mesa, 'libre').subscribe({
      next: () => {
        this.cargarMesas();
      },
      error: (err) => console.warn('Error al liberar mesa en backend:', err),
    });
  }

  private calcularTotalMesa(pedidos: PedidoMesa[], borrador: ItemPedido[]): number {
    const totalPedidos = pedidos.reduce((acc, p) => acc + p.subtotal, 0);
    const totalBorrador = borrador.reduce((acc, i) => acc + i.subtotal, 0);
    return totalPedidos + totalBorrador;
  }
}
