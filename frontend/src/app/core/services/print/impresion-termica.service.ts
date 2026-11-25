import { Injectable, signal } from '@angular/core';

export type AnchoPapelTermico = '80mm' | '58mm';

export interface ConfigImpresionTermica {
  nombreComercio: string;
  direccionYNit: string;
  anchoPapel: AnchoPapelTermico;
  piePagina: string;
  imprimirClienteAlCobrar: boolean;
  imprimirCocinaAlCobrar: boolean;
}

export interface ItemTicketTermico {
  nombre: string;
  cantidad: number;
  precio_unitario?: number;
  subtotal?: number;
  ingredientes_removidos?: string | string[] | null;
  observacion?: string | null;
  notas?: string[];
}

export interface TicketClienteData {
  tipo: 'salon' | 'domicilio';
  numeroFactura?: number | string | null;
  numeroPedido?: number | string | null;
  numeroMesa?: number | string | null;
  mesero?: string | null;
  fecha?: Date | string | null;
  cliente?: {
    nombre?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    zona?: string | null;
  } | null;
  items: ItemTicketTermico[];
  subtotal: number;
  costoEnvio?: number;
  costoEmbalaje?: number;
  propina?: number;
  total: number;
  formaPago?: string | null;
  pagosDetalle?: Array<{ metodo: string; monto: number }>;
  efectivoRecibido?: number;
  cambio?: number;
  observacion?: string | null;
  esPrecuenta?: boolean;
}

export interface TicketCocinaData {
  tipo: 'salon' | 'domicilio';
  numeroPedido?: number | string | null;
  numeroMesa?: number | string | null;
  mesero?: string | null;
  clienteNombre?: string | null;
  zona?: string | null;
  fecha?: Date | string | null;
  items: ItemTicketTermico[];
  observacionGeneral?: string | null;
}

const STORAGE_KEY = 'mesalista_config_impresion_termica_v1';

const CONFIG_POR_DEFECTO: ConfigImpresionTermica = {
  nombreComercio: "LUIGIE'S",
  direccionYNit: 'POPAYÁN, CAUCA — RESTAURANTE NOCTURNO',
  anchoPapel: '80mm',
  piePagina: 'MesaLista - Software gastronómico',
  imprimirClienteAlCobrar: true,
  imprimirCocinaAlCobrar: false,
};

@Injectable({
  providedIn: 'root',
})
export class ImpresionTermicaService {
  config = signal<ConfigImpresionTermica>(this.cargarConfiguracion());

  private cargarConfiguracion(): ConfigImpresionTermica {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return { ...CONFIG_POR_DEFECTO };
      const parsed = JSON.parse(raw);
      return {
        nombreComercio:
          typeof parsed.nombreComercio === 'string' && parsed.nombreComercio.trim()
            ? parsed.nombreComercio.trim()
            : CONFIG_POR_DEFECTO.nombreComercio,
        direccionYNit:
          typeof parsed.direccionYNit === 'string' && parsed.direccionYNit.trim()
            ? parsed.direccionYNit.trim()
            : CONFIG_POR_DEFECTO.direccionYNit,
        anchoPapel: parsed.anchoPapel === '58mm' ? '58mm' : '80mm',
        piePagina:
          typeof parsed.piePagina === 'string' && parsed.piePagina.trim()
            ? parsed.piePagina.trim()
            : CONFIG_POR_DEFECTO.piePagina,
        imprimirClienteAlCobrar:
          typeof parsed.imprimirClienteAlCobrar === 'boolean'
            ? parsed.imprimirClienteAlCobrar
            : CONFIG_POR_DEFECTO.imprimirClienteAlCobrar,
        imprimirCocinaAlCobrar:
          typeof parsed.imprimirCocinaAlCobrar === 'boolean'
            ? parsed.imprimirCocinaAlCobrar
            : CONFIG_POR_DEFECTO.imprimirCocinaAlCobrar,
      };
    } catch {
      return { ...CONFIG_POR_DEFECTO };
    }
  }

  actualizarConfiguracion(parcial: Partial<ConfigImpresionTermica>): void {
    const nueva: ConfigImpresionTermica = {
      ...this.config(),
      ...parcial,
    };
    this.config.set(nueva);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nueva));
      }
    } catch {
      // Ignorar errores de cuota de localStorage
    }
  }

  /**
   * Formatea valores en pesos colombianos con separador de miles por punto (ej. "$ 21.000").
   */
  formatearPesos(valor: number): string {
    const entero = Math.round(Number(valor) || 0);
    const abs = Math.abs(entero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return entero < 0 ? `-$ ${abs}` : `$ ${abs}`;
  }

  private formatearFechaHora(fecha?: Date | string | null): string {
    const d = fecha ? new Date(fecha) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  private escapeHtml(texto?: string | null): string {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private extraerNotasItem(item: ItemTicketTermico): { removidos: string[]; notas: string[] } {
    const removidos: string[] = [];
    const notas: string[] = [];

    if (Array.isArray(item.ingredientes_removidos) && item.ingredientes_removidos.length > 0) {
      removidos.push(...item.ingredientes_removidos.map((s) => String(s).trim()).filter(Boolean));
    } else if (
      typeof item.ingredientes_removidos === 'string' &&
      item.ingredientes_removidos.trim()
    ) {
      removidos.push(item.ingredientes_removidos.trim());
    }

    if (item.observacion && item.observacion.trim()) {
      notas.push(item.observacion.trim());
    }

    if (Array.isArray(item.notas)) {
      for (const n of item.notas) {
        const limpio = String(n || '').trim();
        if (!limpio) continue;
        if (/^sin\s*:/i.test(limpio)) {
          const sinTexto = limpio.replace(/^sin\s*:/i, '').trim();
          if (sinTexto && !removidos.includes(sinTexto)) removidos.push(sinTexto);
        } else if (!notas.includes(limpio)) {
          notas.push(limpio);
        }
      }
    }

    return { removidos, notas };
  }

  private construirEstilosTermicos(anchoPapel: AnchoPapelTermico): string {
    const anchoCss = anchoPapel === '58mm' ? '58mm' : '80mm';
    const anchoContenido = anchoPapel === '58mm' ? '48mm' : '72mm';
    const fontBase = anchoPapel === '58mm' ? '11px' : '12.5px';
    const brandSize = anchoPapel === '58mm' ? '20px' : '25px';
    const totalSize = anchoPapel === '58mm' ? '19px' : '24px';

    return `
      @page {
        size: ${anchoCss} auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: 'Arial', 'Helvetica Neue', 'Liberation Sans', sans-serif;
        font-size: ${fontBase};
        line-height: 1.35;
      }
      .ticket {
        width: ${anchoContenido};
        max-width: ${anchoContenido};
        margin: 0 auto;
        padding: 4mm 1mm 6mm;
      }
      .brand {
        text-align: center;
        font-size: ${brandSize};
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin: 0 0 4px;
      }
      .sub-header {
        text-align: center;
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        margin: 0 0 6px;
        word-break: break-word;
      }
      .kitchen-banner {
        text-align: center;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 1.5px;
        border: 2px solid #000000;
        padding: 3px 4px;
        margin: 0 0 6px;
        text-transform: uppercase;
      }
      .sep {
        border: none;
        border-top: 1.8px dotted #000000;
        margin: 7px 0;
      }
      .sep-solid {
        border: none;
        border-top: 2px solid #000000;
        margin: 7px 0;
      }
      .center-block {
        text-align: center;
        font-size: 11.5px;
        font-weight: 600;
        text-transform: uppercase;
        line-height: 1.4;
      }
      .center-block .meta-line {
        font-size: 10.5px;
        font-weight: 500;
        margin-top: 2px;
      }
      .dest-big {
        text-align: center;
        font-size: 18px;
        font-weight: 900;
        text-transform: uppercase;
        margin: 2px 0;
      }
      .items {
        margin: 4px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 6px;
        margin: 5px 0;
        font-weight: 800;
        font-size: 12px;
        text-transform: uppercase;
      }
      .item-left {
        flex: 1;
        word-break: break-word;
      }
      .item-price {
        white-space: nowrap;
        font-weight: 800;
      }
      .item-sub {
        font-size: 10.5px;
        font-weight: 600;
        margin: 1px 0 3px 12px;
        text-transform: uppercase;
      }
      .kitchen-item {
        margin: 8px 0;
      }
      .kitchen-item-main {
        font-size: 15px;
        font-weight: 900;
        text-transform: uppercase;
        line-height: 1.25;
        word-break: break-word;
      }
      .kitchen-sin {
        font-size: 12px;
        font-weight: 800;
        margin: 3px 0 0 10px;
        text-transform: uppercase;
      }
      .kitchen-note {
        font-size: 11.5px;
        font-weight: 700;
        margin: 2px 0 0 10px;
      }
      .totals {
        margin: 6px 0 4px;
      }
      .total-line {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        margin: 3px 0;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .grand-total {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin: 8px 0 6px;
        font-size: ${totalSize};
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .payment-info {
        font-size: 11px;
        font-weight: 600;
        margin: 4px 0;
        text-transform: uppercase;
      }
      .note-box {
        font-size: 11.5px;
        font-weight: 700;
        margin: 5px 0;
        padding: 4px 5px;
        border: 1.5px dashed #000000;
        word-break: break-word;
      }
      .disclaimer {
        font-style: italic;
        font-size: 11.5px;
        margin: 10px 0 6px;
        text-align: left;
      }
      .footer {
        text-align: center;
        font-size: 11.5px;
        font-weight: 600;
        margin-top: 6px;
      }
    `;
  }

  /**
   * Genera el documento HTML térmico completo para la factura / comprobante del cliente
   * (diseño inspirado en el comprobante de Love Bites / OlaClick, adaptado para Luigie's).
   */
  generarHtmlFacturaCliente(data: TicketClienteData): string {
    const cfg = this.config();
    const fechaTxt = this.formatearFechaHora(data.fecha);

    const lineasDestino: string[] = [];
    if (data.tipo === 'domicilio') {
      if (data.cliente?.nombre) {
        lineasDestino.push(`<div>${this.escapeHtml(data.cliente.nombre)}</div>`);
      }
      if (data.cliente?.telefono) {
        const tel = data.cliente.telefono.trim();
        const telFormateado = /^\d{10}$/.test(tel) ? `57 ${tel}` : tel;
        lineasDestino.push(`<div>${this.escapeHtml(telFormateado)}</div>`);
      }
      if (data.cliente?.direccion) {
        const dirFull = data.cliente.zona
          ? `${data.cliente.direccion} — ${data.cliente.zona}`
          : data.cliente.direccion;
        lineasDestino.push(`<div>${this.escapeHtml(dirFull)}</div>`);
      }
      const refDomi = [
        data.numeroPedido ? `DOMICILIO #${data.numeroPedido}` : 'DOMICILIO',
        data.numeroFactura ? `FAC-#${data.numeroFactura}` : data.esPrecuenta ? 'PRE-CUENTA' : '',
        fechaTxt,
      ]
        .filter(Boolean)
        .join(' • ');
      lineasDestino.push(`<div class="meta-line">${this.escapeHtml(refDomi)}</div>`);
    } else {
      lineasDestino.push(
        `<div>${this.escapeHtml(data.numeroMesa ? `MESA #${data.numeroMesa}` : 'VENTA EN SALÓN')}</div>`,
      );
      if (data.mesero) {
        lineasDestino.push(`<div>ATENDIDO POR: ${this.escapeHtml(data.mesero)}</div>`);
      }
      if (data.cliente?.nombre) {
        lineasDestino.push(`<div>CLIENTE: ${this.escapeHtml(data.cliente.nombre)}</div>`);
      }
      const refSalon = [
        data.numeroFactura ? `FAC-#${data.numeroFactura}` : data.esPrecuenta ? 'PRE-CUENTA' : '',
        fechaTxt,
      ]
        .filter(Boolean)
        .join(' • ');
      if (refSalon) {
        lineasDestino.push(`<div class="meta-line">${this.escapeHtml(refSalon)}</div>`);
      }
    }

    const itemsHtml = (data.items || [])
      .map((item) => {
        const cant = Number(item.cantidad) || 1;
        const sub =
          item.subtotal !== undefined
            ? Number(item.subtotal)
            : cant * (Number(item.precio_unitario) || 0);
        const { removidos, notas } = this.extraerNotasItem(item);
        const subLineas = [
          ...removidos.map((r) => `<div class="item-sub">SIN: ${this.escapeHtml(r)}</div>`),
          ...notas.map((n) => `<div class="item-sub">* ${this.escapeHtml(n)}</div>`),
        ].join('');

        return `
          <div class="item-row">
            <span class="item-left">X${cant} ${this.escapeHtml(item.nombre)}</span>
            <span class="item-price">${this.escapeHtml(this.formatearPesos(sub))}</span>
          </div>
          ${subLineas}
        `;
      })
      .join('');

    const envio = Number(data.costoEnvio) || 0;
    const embalaje = Number(data.costoEmbalaje) || 0;
    const propina = Number(data.propina) || 0;

    const lineasTotales: string[] = [
      `<div class="total-line"><span>SUBTOTAL</span><span>${this.escapeHtml(this.formatearPesos(data.subtotal))}</span></div>`,
    ];
    if (envio > 0) {
      lineasTotales.push(
        `<div class="total-line"><span>PRECIO DE ENTREGA</span><span>${this.escapeHtml(this.formatearPesos(envio))}</span></div>`,
      );
    }
    if (embalaje > 0) {
      lineasTotales.push(
        `<div class="total-line"><span>PRECIO DE EMBALAJE</span><span>${this.escapeHtml(this.formatearPesos(embalaje))}</span></div>`,
      );
    }
    if (propina > 0) {
      lineasTotales.push(
        `<div class="total-line"><span>PROPINA VOLUNTARIA</span><span>${this.escapeHtml(this.formatearPesos(propina))}</span></div>`,
      );
    }

    const lineasPago: string[] = [];
    if (data.pagosDetalle && data.pagosDetalle.length > 1) {
      const resumenPagos = data.pagosDetalle
        .map((p) => `${p.metodo}: ${this.formatearPesos(p.monto)}`)
        .join(' | ');
      lineasPago.push(`<div class="payment-info">PAGOS: ${this.escapeHtml(resumenPagos)}</div>`);
    } else if (data.formaPago) {
      lineasPago.push(`<div class="payment-info">PAGO: ${this.escapeHtml(data.formaPago)}</div>`);
    }
    if (data.efectivoRecibido && data.efectivoRecibido > 0) {
      const cambio = Number(data.cambio) || 0;
      lineasPago.push(
        `<div class="payment-info">RECIBIDO: ${this.escapeHtml(this.formatearPesos(data.efectivoRecibido))}${cambio > 0 ? `  |  CAMBIO: ${this.escapeHtml(this.formatearPesos(cambio))}` : ''}</div>`,
      );
    }

    const obsHtml =
      data.observacion && data.observacion.trim()
        ? `<div class="note-box">NOTA: ${this.escapeHtml(data.observacion.trim())}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura ${this.escapeHtml(cfg.nombreComercio)}</title>
  <style>${this.construirEstilosTermicos(cfg.anchoPapel)}</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">${this.escapeHtml(cfg.nombreComercio)}</div>
    <div class="sub-header">${this.escapeHtml(cfg.direccionYNit)}</div>
    <hr class="sep" />
    <div class="center-block">${lineasDestino.join('')}</div>
    <hr class="sep" />
    <div class="items">${itemsHtml}</div>
    <hr class="sep" />
    <div class="totals">${lineasTotales.join('')}</div>
    <div class="grand-total">
      <span>TOTAL</span>
      <span>${this.escapeHtml(this.formatearPesos(data.total))}</span>
    </div>
    ${lineasPago.join('')}
    ${obsHtml}
    <div class="disclaimer">Este documento no tiene valor fiscal.</div>
    <hr class="sep" />
    <div class="footer">${this.escapeHtml(cfg.piePagina)}</div>
  </div>
</body>
</html>`;
  }

  /**
   * Genera el documento HTML térmico optimizado para la impresora de comandas de cocina
   * (sin precios, cantidades e ítems grandes en negrita, ingredientes removidos y notas destacados).
   */
  generarHtmlComandaCocina(data: TicketCocinaData): string {
    const cfg = this.config();
    const fechaTxt = this.formatearFechaHora(data.fecha);

    const destinoTitulo =
      data.tipo === 'domicilio'
        ? data.numeroPedido
          ? `DOMICILIO #${data.numeroPedido}`
          : 'DOMICILIO'
        : data.numeroMesa
          ? `MESA #${data.numeroMesa}`
          : 'PEDIDO SALÓN';

    const metaLineas: string[] = [];
    if (data.tipo === 'salon' && data.numeroPedido) {
      metaLineas.push(`<div>COMANDA #${this.escapeHtml(String(data.numeroPedido))}</div>`);
    }
    if (fechaTxt) {
      metaLineas.push(`<div class="meta-line">${this.escapeHtml(fechaTxt)}</div>`);
    }
    if (data.mesero) {
      metaLineas.push(`<div>ATENDIÓ: ${this.escapeHtml(data.mesero)}</div>`);
    }
    if (data.tipo === 'domicilio' && data.clienteNombre) {
      metaLineas.push(`<div>CLIENTE: ${this.escapeHtml(data.clienteNombre)}</div>`);
    }
    if (data.tipo === 'domicilio' && data.zona) {
      metaLineas.push(`<div class="meta-line">ZONA: ${this.escapeHtml(data.zona)}</div>`);
    }

    let totalUnidades = 0;
    const itemsHtml = (data.items || [])
      .map((item) => {
        const cant = Number(item.cantidad) || 1;
        totalUnidades += cant;
        const { removidos, notas } = this.extraerNotasItem(item);

        const sinHtml =
          removidos.length > 0
            ? `<div class="kitchen-sin">** SIN: ${this.escapeHtml(removidos.join(', '))} **</div>`
            : '';
        const notasHtml = notas
          .map((n) => `<div class="kitchen-note">* NOTA: ${this.escapeHtml(n)}</div>`)
          .join('');

        return `
          <div class="kitchen-item">
            <div class="kitchen-item-main">X${cant} ${this.escapeHtml(item.nombre)}</div>
            ${sinHtml}
            ${notasHtml}
          </div>
        `;
      })
      .join('');

    const notaGeneralHtml =
      data.observacionGeneral && data.observacionGeneral.trim()
        ? `<div class="note-box">NOTA GENERAL: ${this.escapeHtml(data.observacionGeneral.trim())}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Comanda Cocina ${this.escapeHtml(cfg.nombreComercio)}</title>
  <style>${this.construirEstilosTermicos(cfg.anchoPapel)}</style>
</head>
<body>
  <div class="ticket">
    <div class="kitchen-banner">*** COMANDA COCINA ***</div>
    <div class="brand" style="font-size: 18px; margin-bottom: 2px;">${this.escapeHtml(cfg.nombreComercio)}</div>
    <hr class="sep-solid" />
    <div class="dest-big">${this.escapeHtml(destinoTitulo)}</div>
    <div class="center-block">${metaLineas.join('')}</div>
    <hr class="sep-solid" />
    <div class="items">${itemsHtml}</div>
    ${notaGeneralHtml}
    <hr class="sep" />
    <div class="center-block">TOTAL ÍTEMS: ${totalUnidades} ${totalUnidades === 1 ? 'UNIDAD' : 'UNIDADES'}</div>
    <hr class="sep" />
    <div class="footer">${this.escapeHtml(cfg.piePagina)}</div>
  </div>
</body>
</html>`;
  }

  imprimirFacturaCliente(data: TicketClienteData): void {
    const html = this.generarHtmlFacturaCliente(data);
    this.enviarAImpresora(html);
  }

  imprimirComandaCocina(data: TicketCocinaData): void {
    const html = this.generarHtmlComandaCocina(data);
    this.enviarAImpresora(html);
  }

  /**
   * Envía un documento HTML térmico directamente al diálogo de impresión del sistema
   * mediante un iframe aislado de tamaño térmico (80mm / 58mm), sin imprimir la interfaz web.
   */
  private enviarAImpresora(htmlDocumento: string): void {
    if (typeof document === 'undefined') return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const limpiar = () => {
      try {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch {
        // Ignorar si ya fue removido
      }
    };

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;

    if (!win || !doc) {
      limpiar();
      return;
    }

    doc.open();
    doc.write(htmlDocumento);
    doc.close();

    const ejecutarImpresion = () => {
      try {
        win.focus();
        win.print();
      } catch {
        // Fallback si el navegador restringe print() en iframe
      } finally {
        setTimeout(limpiar, 1500);
      }
    };

    if (typeof win.addEventListener === 'function') {
      win.addEventListener('afterprint', limpiar, { once: true });
    }

    setTimeout(ejecutarImpresion, 80);
  }
}
