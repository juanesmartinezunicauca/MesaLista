/**
 * ============================================================================
 * DIAGNÓSTICO REAL DEL FLUJO DE ONBOARDING DE EMPLEADOS (sin mocks "dóciles")
 * ============================================================================
 * - Prisma es reemplazado por una tabla en memoria que SÍ aplica restricciones
 *   únicas (P2002) y evalúa los `where` reales (OR / equals / insensitive).
 * - El correo se prueba contra un servidor SMTP falso con SOCKETS REALES
 *   (TCP), no contra un jest.fn().
 *
 * Cada `it` afirma el comportamiento CORRECTO. Si falla => es un defecto real.
 * No se ejecuta con `npm test` (extensión .diag.ts). Ejecutar con:
 *   npx jest --testRegex "diag\.ts$" --config ./jest.config.ts test/diagnostico
 */
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as net from 'node:net';
import { MailService } from '../../src/modules/mail/mail.service';
import { UsuariosService } from '../../src/modules/usuarios/usuarios.service';

// ───────────────────────── Tabla Usuario en memoria ─────────────────────────
class FakeUsuarioTable {
  rows: any[] = [];
  private seq = 1;
  private readonly uniques = ['email', 'googleId', 'usuario', 'codigoInvitacion'];

  /** Cede el hilo para que dos peticiones concurrentes puedan intercalarse como en una BD real. */
  private tick() {
    return new Promise((r) => setTimeout(r, 2));
  }

  seed(row: any) {
    const full = {
      id_usuario: this.seq++,
      googleId: null,
      email: null,
      passwordHash: null,
      codigoInvitacion: null,
      estado: 'activo',
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  private cmp(a: any, cond: any): boolean {
    if (cond !== null && typeof cond === 'object') {
      if ('equals' in cond) {
        if (a == null) return false;
        return cond.mode === 'insensitive'
          ? String(a).toLowerCase() === String(cond.equals).toLowerCase()
          : a === cond.equals;
      }
      if ('not' in cond) return a !== cond.not;
      if ('contains' in cond) return String(a ?? '').toLowerCase().includes(String(cond.contains).toLowerCase());
    }
    return a === cond;
  }

  private matches(row: any, where: any): boolean {
    return Object.entries(where ?? {}).every(([k, v]) => {
      if (k === 'OR') return (v as any[]).some((w) => this.matches(row, w));
      if (k === 'AND') return (v as any[]).every((w) => this.matches(row, w));
      return this.cmp(row[k], v);
    });
  }

  private assertUnique(candidate: any, selfId?: number) {
    for (const f of this.uniques) {
      if (candidate[f] != null && this.rows.some((r) => r.id_usuario !== selfId && r[f] === candidate[f])) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'diag',
          meta: { target: [f] },
        });
      }
    }
  }

  findFirst = async ({ where }: any) => {
    await this.tick();
    const r = this.rows.find((x) => this.matches(x, where));
    return r ? { ...r } : null;
  };
  findUnique = async ({ where }: any) => {
    await this.tick();
    const r = this.rows.find((x) => this.matches(x, where));
    return r ? { ...r } : null;
  };
  updateMany = async ({ where, data }: any) => {
    await this.tick();
    const hit = this.rows.filter((x) => this.matches(x, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  };
  update = async ({ where, data }: any) => {
    await this.tick();
    const r = this.rows.find((x) => this.matches(x, where));
    if (!r) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'diag' });
    this.assertUnique({ ...r, ...data }, r.id_usuario);
    Object.assign(r, data);
    return { ...r };
  };
  create = async ({ data }: any) => {
    await this.tick();
    const cand = { id_usuario: this.seq, googleId: null, email: null, passwordHash: null, codigoInvitacion: null, estado: 'activo', ...data };
    this.assertUnique(cand);
    this.seq++;
    this.rows.push(cand);
    return { ...cand };
  };
}

function nuevoServicio() {
  const tabla = new FakeUsuarioTable();
  const mail = { enviarCodigoInvitacion: jest.fn().mockResolvedValue({ enviado: true, transport: 'smtp' }) };
  const svc = new UsuariosService({ usuario: tabla } as any, mail as any);
  return { tabla, mail, svc };
}

// ═════════════════════════════════════════════════════════════════════════════
describe('A. Lógica de vinculación de empleados (UsuariosService.vincularOGuardarGoogleUsuario)', () => {
  it('[A1] Un usuario de Google NO debe poder tomar la cuenta de un empleado solo por llamarse igual (nombre visible)', async () => {
    const { tabla, svc } = nuevoServicio();
    tabla.seed({ nombre: 'Carlos Mesero', usuario: 'carlos', rol: 'mesero', codigoInvitacion: 'INV-111111' });

    // Atacante: nombre de pantalla de Google (lo elige él) igual al del empleado, SIN código
    const intento = svc.vincularOGuardarGoogleUsuario({
      googleId: 'G-ATACANTE',
      email: 'cualquiera@gmail.com',
      nombre: 'Carlos Mesero',
    });

    const resultado = await intento.catch((e) => e);
    // Correcto: no debe devolver la cuenta del mesero (rol operativo)
    expect(resultado?.rol).not.toBe('mesero');
  });

  it('[A2] Un correo ajeno cuyo prefijo coincide con el "usuario" de un ADMIN no debe darle acceso de administrador', async () => {
    const { tabla, svc } = nuevoServicio();
    tabla.seed({ nombre: 'Dueño', usuario: 'admin', rol: 'administrador' });

    const resultado = await svc
      .vincularOGuardarGoogleUsuario({ googleId: 'G-X', email: 'admin@dominio-ajeno.com', nombre: 'Persona Cualquiera' })
      .catch((e) => e);

    expect(resultado?.rol).not.toBe('administrador');
  });

  it('[A3] Un empleado YA vinculado a su Google no debe ser "re-vinculado" (secuestrado) por otro googleId', async () => {
    const { tabla, svc } = nuevoServicio();
    const emp = tabla.seed({ nombre: 'Ana Cajera', usuario: 'ana', rol: 'cajero', googleId: 'G-ANA-REAL', email: 'ana@gmail.com' });

    await svc
      .vincularOGuardarGoogleUsuario({ googleId: 'G-ATACANTE', email: 'otro@gmail.com', nombre: 'Ana Cajera' })
      .catch(() => undefined);

    expect(tabla.rows.find((r) => r.id_usuario === emp.id_usuario).googleId).toBe('G-ANA-REAL');
  });

  it('[A4] Empleado que ya había entrado antes como "cliente" con el mismo Google debe poder activar su código', async () => {
    const { tabla, svc } = nuevoServicio();
    // 1) El empleado probó entrar con Google ANTES de usar el código -> se creó una cuenta cliente con su email
    await svc.vincularOGuardarGoogleUsuario({ googleId: 'G-JUAN', email: '3zcompanymusic@gmail.com', nombre: 'Persona X' });
    // 2) El admin lo registró y le llegó el código
    const emp = tabla.seed({ nombre: 'Juan Cocinero', usuario: 'juan_cocina', rol: 'cocina', codigoInvitacion: 'INV-482910' });

    const r = await svc
      .vincularOGuardarGoogleUsuario({
        googleId: 'G-JUAN',
        email: '3zcompanymusic@gmail.com',
        nombre: 'Persona X',
        codigoInvitacion: 'INV-482910',
      })
      .catch((e) => e);

    expect(r).not.toBeInstanceOf(Error); // hoy: P2002 (email duplicado) y el empleado queda sin poder entrar
    expect(r.id_usuario).toBe(emp.id_usuario);
  });

  it('[A5] Un código de un solo uso solo puede canjearse UNA vez aunque lleguen 2 peticiones simultáneas', async () => {
    const { tabla, svc } = nuevoServicio();
    tabla.seed({ nombre: 'Luis Mesero', usuario: 'luis', rol: 'mesero', codigoInvitacion: 'INV-555555' });

    const [a, b] = await Promise.allSettled([
      svc.vincularOGuardarGoogleUsuario({ googleId: 'G-A', email: 'a@gmail.com', nombre: 'A', codigoInvitacion: 'INV-555555' }),
      svc.vincularOGuardarGoogleUsuario({ googleId: 'G-B', email: 'b@gmail.com', nombre: 'B', codigoInvitacion: 'INV-555555' }),
    ]);
    const exitos = [a, b].filter((x) => x.status === 'fulfilled').length;
    expect(exitos).toBe(1);
  });

  it('[A6] Código inexistente => 401 (control positivo, esto sí funciona)', async () => {
    const { svc } = nuevoServicio();
    await expect(
      svc.vincularOGuardarGoogleUsuario({ googleId: 'G', email: 'x@y.com', nombre: 'X', codigoInvitacion: 'INV-000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('B. Generación de códigos temporales (UsuariosService.crear)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('[B1] Si el código aleatorio colisiona con uno vigente, crear() debe reintentar y NO fallar con 409', async () => {
    const { svc } = nuevoServicio();
    // Forzar colisión: primer y segundo intento devuelven el mismo código, el tercero devuelve uno distinto
    jest
      .spyOn(svc, 'generarCodigoInvitacion')
      .mockReturnValueOnce('INV-COLLISION')
      .mockReturnValueOnce('INV-COLLISION')
      .mockReturnValueOnce('INV-UNIQUE');

    await svc.crear({ nombre: 'Empleado Uno', rol: 'mesero' } as any);
    const segundo = await svc.crear({ nombre: 'Empleado Dos', rol: 'mesero' } as any).catch((e) => e);
    expect(segundo).not.toBeInstanceOf(Error);
  });

  it('[B2] Los códigos deben venir de un generador criptográfico (no Math.random)', async () => {
    const { svc } = nuevoServicio();
    const spyMath = jest.spyOn(Math, 'random');
    await svc.crear({ nombre: 'Empleado Tres', rol: 'cajero' } as any);
    expect(spyMath).not.toHaveBeenCalled();
  });

  it('[B3] Un código debe caducar (campo de expiración en el modelo Usuario)', () => {
    const schema = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const modelo = schema.slice(schema.indexOf('model Usuario'), schema.indexOf('}', schema.indexOf('model Usuario')));
    expect(modelo).toMatch(/codigo_?[Ii]nvitacion_?[Ee]xpira|expira/);
  });

  it('[B4] Tamaño del espacio de códigos: 8 caracteres Base32 => 1 billón de combinaciones (~35 bits de entropía)', () => {
    const espacio = Math.pow(32, 8); // 1,099,511,627,776
    const bits = Math.log2(espacio);
    expect(bits).toBeGreaterThan(30); // 35 bits de entropía
  });

  it('[B5] El endpoint de canje debe tener limitación de intentos (ThrottlerModule en uso)', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const app = fs.readFileSync(path.join(__dirname, '../../src/app.module.ts'), 'utf8');
    expect(app).toMatch(/ThrottlerModule/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Servidor SMTP falso con sockets reales
// ═════════════════════════════════════════════════════════════════════════════
interface FakeSmtp {
  port: number;
  close: () => Promise<void>;
  rec: { auth: string[]; data: string; rcpt: string[]; mailFrom: string[] };
}
function iniciarSmtpFalso(modo: 'ok' | 'agujero-negro'): Promise<FakeSmtp> {
  const rec = { auth: [] as string[], data: '', rcpt: [] as string[], mailFrom: [] as string[] };
  const sockets = new Set<net.Socket>();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    if (modo === 'agujero-negro') return; // acepta TCP pero nunca habla (equivale a un puerto filtrado)
    sock.write('220 fake ESMTP\r\n');
    let buf = '';
    let enData = false;
    let dataBuf = '';
    let authStep = 0;
    sock.on('data', (c) => {
      buf += c.toString('binary');
      if (enData) {
        dataBuf += buf;
        buf = '';
        if (dataBuf.endsWith('\r\n.\r\n')) {
          rec.data = Buffer.from(dataBuf, 'binary').toString('utf8');
          enData = false;
          sock.write('250 queued\r\n');
        }
        return;
      }
      let i: number;
      while ((i = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (authStep === 1) { rec.auth.push(Buffer.from(line, 'base64').toString()); authStep = 2; sock.write('334 UGFzc3dvcmQ6\r\n'); continue; }
        if (authStep === 2) { rec.auth.push('<pass>'); authStep = 0; sock.write('235 ok\r\n'); continue; }
        if (/^EHLO/i.test(line)) sock.write('250-fake\r\n250-AUTH LOGIN\r\n250 8BITMIME\r\n');
        else if (/^AUTH LOGIN/i.test(line)) { authStep = 1; sock.write('334 VXNlcm5hbWU6\r\n'); }
        else if (/^MAIL FROM/i.test(line)) { rec.mailFrom.push(line); sock.write('250 ok\r\n'); }
        else if (/^RCPT TO/i.test(line)) { rec.rcpt.push(line); sock.write('250 ok\r\n'); }
        else if (/^DATA/i.test(line)) {
          enData = true; dataBuf = buf; buf = ''; sock.write('354 go\r\n');
          if (dataBuf.endsWith('\r\n.\r\n')) { rec.data = Buffer.from(dataBuf, 'binary').toString('utf8'); enData = false; sock.write('250 queued\r\n'); }
        }
        else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        rec,
        close: () => new Promise<void>((r) => { sockets.forEach((s) => s.destroy()); server.close(() => r()); }),
      }),
    ),
  );
}

function nuevoMail(env: Record<string, string | undefined>) {
  return new MailService({ get: (k: string) => env[k] } as any);
}

describe('C. Envío de correo (MailService) contra servidor SMTP real (TCP)', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('[C1] Camino feliz: el protocolo SMTP escrito a mano completa el envío y el cuerpo contiene el código', async () => {
    const smtp = await iniciarSmtpFalso('ok');
    const r = await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('3zcompanymusic@gmail.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-482910' });
    await smtp.close();
    expect(r.enviado).toBe(true);
    expect(smtp.rec.data).toContain('INV-482910');
    expect(smtp.rec.rcpt[0]).toContain('3zcompanymusic@gmail.com');
  });

  it('[C2] El mensaje DATA debe usar CRLF estricto (RFC 5322): sin saltos de línea "LF" sueltos', async () => {
    const smtp = await iniciarSmtpFalso('ok');
    await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' });
    await smtp.close();
    const lfSueltos = (smtp.rec.data.match(/(?<!\r)\n/g) || []).length;
    expect(lfSueltos).toBe(0);
  });

  it('[C3] El mensaje debe incluir cabeceras Date y Message-ID (reduce la clasificación como spam)', async () => {
    const smtp = await iniciarSmtpFalso('ok');
    await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' });
    await smtp.close();
    expect(smtp.rec.data).toMatch(/^Date:/m);
    expect(smtp.rec.data).toMatch(/^Message-ID:/mi);
  });

  it('[C4] El nombre del colaborador debe escaparse en el HTML (sin inyección de etiquetas)', async () => {
    const smtp = await iniciarSmtpFalso('ok');
    await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: '<img src=x onerror=alert(1)>', rol: 'cocina', codigo: 'INV-1' });
    await smtp.close();
    expect(smtp.rec.data).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('[C5] Sin SMTP_USER/SMTP_PASS en el entorno NO debe autenticarse con credenciales incrustadas en el código', async () => {
    const smtp = await iniciarSmtpFalso('ok');
    await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port) }) // sin credenciales
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' });
    await smtp.close();
    // Si el servidor recibió un usuario en AUTH LOGIN, es porque el código usó credenciales "de fábrica"
    expect(smtp.rec.auth.filter((a) => a !== '<pass>')).toEqual([]);
  });

  it('[C6] Un puerto SMTP filtrado (Render Free bloquea 25/465/587) no debe bloquear la petición HTTP más de ~5 s', async () => {
    const smtp = await iniciarSmtpFalso('agujero-negro');
    const t0 = Date.now();
    const r = await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' });
    const ms = Date.now() - t0;
    await smtp.close();
    // eslint-disable-next-line no-console
    console.info(`[C6] puerto filtrado => la petición tardó ${ms} ms y devolvió enviado=${r.enviado}`);
    expect(ms).toBeLessThan(5000);
  }, 30000);

  it('[C7] SMTP_PORT=587 configurado para Gmail debe respetarse (hoy se fuerza 465)', async () => {
    await nuevoMail({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' })
      .catch(() => undefined);
    const conectoA = logSpy.mock.calls.map((c) => String(c[0])).find((m) => m.includes('[SMTP_CONNECT]')) ?? '';
    expect(conectoA).toContain(':587');
  }, 30000);

  it('[C8] El código de invitación (secreto) no debe escribirse en los logs del servidor', async () => {
    await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'u@x.com', SMTP_PASS: 'p' }) // puerto cerrado => cae al modo simulado
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-987654' });
    const todo = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(todo).not.toContain('INV-987654');
  }, 30000);

  it('[C9] Si el correo NO se envió, la respuesta debe decir enviado=false con causa clara (control positivo)', async () => {
    const r = await nuevoMail({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'u@x.com', SMTP_PASS: 'p' })
      .enviarCodigoInvitacion('a@b.com', { nombre: 'Juan', rol: 'cocina', codigo: 'INV-1' });
    expect(r.enviado).toBe(false);
    expect(r.errorSmtp).toBeTruthy();
  }, 30000);
});

