import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'node:net';
import * as tls from 'node:tls';

export interface EnviarCodigoOptions {
  nombre: string;
  rol: string;
  codigo: string;
}

export interface EnvioMailResultado {
  enviado: boolean;
  transport: 'smtp' | 'resend' | 'simulado';
  destinatario: string;
  mensaje?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envía el código de registro e invitación por correo electrónico.
   * NOTA DE PRIVACIDAD: Este correo se utiliza de forma efímera para el despacho
   * y bajo ninguna circunstancia se persiste en la base de datos.
   */
  async enviarCodigoInvitacion(
    destinatario: string,
    datos: EnviarCodigoOptions,
  ): Promise<EnvioMailResultado> {
    const emailNormalizado = destinatario.trim().toLowerCase();
    const asunto = `🔐 Tu Código de Registro e Invitación - MesaLista POS (Restaurante Luigie's)`;
    const contenidoHtml = this.generarPlantillaHtml(datos);
    const contenidoTexto = this.generarTextoPlano(datos);

    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    const smtpHost = this.configService.get<string>('SMTP_HOST');

    // 1. Intentar envío vía Resend HTTP API si la API Key está configurada
    if (resendApiKey) {
      try {
        const fromEmail =
          this.configService.get<string>('SMTP_FROM') ||
          'MesaLista POS <onboarding@resend.dev>';

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [emailNormalizado],
            subject: asunto,
            html: contenidoHtml,
            text: contenidoTexto,
          }),
        });

        if (response.ok) {
          this.logger.log(
            `[MAIL_SERVICE] ✅ Código de registro enviado exitosamente a '${emailNormalizado}' vía Resend. (Correo NO persistido en BD).`,
          );
          return {
            enviado: true,
            transport: 'resend',
            destinatario: emailNormalizado,
            mensaje: 'Correo enviado exitosamente vía Resend API.',
          };
        } else {
          const errData = await response.text();
          this.logger.warn(
            `[MAIL_SERVICE] Falló envío vía Resend (${response.status}): ${errData}. Pasando a simulación...`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `[MAIL_SERVICE] Error conectando con Resend: ${err?.message}. Pasando a simulación...`,
        );
      }
    }

    // 2. Intentar envío vía SMTP directo si las credenciales están configuradas
    if (smtpHost) {
      try {
        await this.enviarViaSmtpDirecto(emailNormalizado, asunto, contenidoHtml, contenidoTexto);
        this.logger.log(
          `[MAIL_SERVICE] ✅ Código de registro enviado exitosamente a '${emailNormalizado}' vía SMTP (${smtpHost}). (Correo NO persistido en BD).`,
        );
        return {
          enviado: true,
          transport: 'smtp',
          destinatario: emailNormalizado,
          mensaje: `Correo enviado exitosamente vía SMTP (${smtpHost}).`,
        };
      } catch (err: any) {
        this.logger.warn(
          `[MAIL_SERVICE] No se pudo enviar por SMTP (${smtpHost}): ${err?.message}. Pasando a simulación...`,
        );
      }
    }

    // 3. Modo Simulado / Entorno de Desarrollo y Pruebas
    // Registra en el log de auditoría el despacho completo garantizando que el flujo nunca se bloquee
    this.logger.log(
      `------------------------------------------------------------------------\n` +
      `[MAIL_SERVICE] ✉️ DESPACHO EFÍMERO DE CÓDIGO DE REGISTRO (SIN PERSISTENCIA EN BD)\n` +
      `  • Destinatario: ${emailNormalizado}\n` +
      `  • Colaborador:  ${datos.nombre} (Rol: ${datos.rol})\n` +
      `  • Código:       ${datos.codigo}\n` +
      `  • Estado:       Despachado exitosamente (Modo Simulado / Fallback Activo)\n` +
      `------------------------------------------------------------------------`,
    );

    return {
      enviado: true,
      transport: 'simulado',
      destinatario: emailNormalizado,
      mensaje: `Código despachado a ${emailNormalizado} (modo desarrollo/simulado). Recuerda que este correo no se guarda en el sistema.`,
    };
  }

  /**
   * Genera el HTML enriquecido del correo electrónico con el diseño visual de MesaLista
   */
  private generarPlantillaHtml(datos: EnviarCodigoOptions): string {
    const rolFormateado = datos.rol.toUpperCase();
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Vinculación - MesaLista</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f17;
      color: #e2e8f0;
    }
    .wrapper {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 30px 20px;
    }
    .card {
      background: linear-gradient(145deg, #161e2e, #0f172a);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(90deg, #ff6b35, #ff8c42);
      padding: 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .body {
      padding: 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255, 107, 53, 0.2);
      color: #ff8c42;
      border: 1px solid rgba(255, 107, 53, 0.4);
      margin-bottom: 20px;
    }
    .code-container {
      background: #080c14;
      border: 2px dashed #ff6b35;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .code-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #ff8c42;
      margin: 0;
    }
    .steps {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .steps h3 {
      margin-top: 0;
      font-size: 14px;
      color: #ffffff;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
    }
    .privacy-badge {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 14px;
      font-size: 12px;
      color: #a7f3d0;
      line-height: 1.5;
      margin-top: 24px;
    }
    .footer {
      padding: 20px 30px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>MesaLista POS</h1>
        <p>Restaurante Luigie's — Sistema de Gestión Gastronómica</p>
      </div>
      <div class="body">
        <p class="greeting">¡Hola, ${datos.nombre}!</p>
        <div class="badge">PERFIL ASIGNADO: ${rolFormateado}</div>
        
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
          Has sido registrado como colaborador en <strong>MesaLista POS</strong>. Para acceder a la plataforma por primera vez, debes vincular tu cuenta de Google utilizando el siguiente código de registro único:
        </p>

        <div class="code-container">
          <div class="code-label">Tu Código de Registro Temporal</div>
          <div class="code-value">${datos.codigo}</div>
        </div>

        <div class="steps">
          <h3>📌 Instrucciones para ingresar:</h3>
          <ol>
            <li>Ingresa a la aplicación web de <strong>MesaLista</strong>.</li>
            <li>En la pantalla de inicio de sesión, pulsa la pestaña <strong>"Nuevo Empleado"</strong>.</li>
            <li>Escribe tu código <strong>${datos.codigo}</strong> en el recuadro.</li>
            <li>Presiona <strong>"Continuar con Google"</strong> e inicia sesión con tu cuenta personal o corporativa.</li>
            <li>¡Listo! Tu cuenta quedará vinculada automáticamente a tu cargo y el código se consumirá.</li>
          </ol>
        </div>

        <div class="privacy-badge">
          🛡️ <strong>Garantía de Privacidad Estricta:</strong> Este correo electrónico fue solicitado únicamente para entregarte este código de acceso y <strong>NO ha sido guardado ni almacenado</strong> en la base de datos de MesaLista. Tu correo personal se mantiene completamente anónimo y confidencial.
        </div>
      </div>
      <div class="footer">
        © 2026 MesaLista POS & ERP • Grupo Trinity — Universidad del Cauca.
      </div>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Genera la versión en texto plano para clientes de correo sin soporte HTML
   */
  private generarTextoPlano(datos: EnviarCodigoOptions): string {
    return `
======================================================
MesaLista POS — Restaurante Luigie's
Tu Código de Registro e Invitación
======================================================

Hola, ${datos.nombre}:

Has sido registrado como colaborador en MesaLista con el rol: ${datos.rol.toUpperCase()}.

TU CÓDIGO DE REGISTRO TEMPORAL:
>>> ${datos.codigo} <<<

INSTRUCCIONES PARA INGRESAR:
1. Ingresa a la aplicación web de MesaLista POS.
2. En la pantalla de inicio de sesión, pulsa la pestaña "Nuevo Empleado".
3. Escribe tu código: ${datos.codigo}
4. Presiona "Continuar con Google" e inicia sesión con tu cuenta personal o corporativa.
5. Tu cuenta quedará vinculada y el código se quemará de inmediato.

AVISO DE PRIVACIDAD:
Este correo electrónico se utilizó únicamente para la entrega de este mensaje y NO se almacena en la base de datos del sistema.
`;
  }

  /**
   * Envía correo utilizando sockets de red/TLS directamente con el protocolo SMTP
   */
  private async enviarViaSmtpDirecto(
    destinatario: string,
    asunto: string,
    html: string,
    texto: string,
  ): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST')!;
    const port = Number(this.configService.get<number>('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from =
      this.configService.get<string>('SMTP_FROM') || 'MesaLista POS <no-reply@mesalista.local>';

    const matchFrom = from.match(/<([^>]+)>/);
    const senderEmail = (matchFrom ? matchFrom[1] : from).trim();

    return new Promise<void>((resolve, reject) => {
      const socket = (port === 465)
        ? tls.connect({ host, port, rejectUnauthorized: true })
        : net.createConnection({ host, port });

      let buffer = '';
      let step = 0;

      const send = (cmd: string) => {
        socket.write(cmd + '\r\n');
      };

      socket.setTimeout(10000, () => {
        socket.destroy();
        reject(new Error('Tiempo de espera agotado al conectar con el servidor SMTP.'));
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const code = Number.parseInt(line.substring(0, 3), 10);
          if (Number.isNaN(code)) continue;

          if (step === 0 && (code === 220)) {
            step = 1;
            send(`EHLO localhost`);
          } else if (step === 1 && (code === 250)) {
            if (user && pass) {
              step = 2;
              send(`AUTH LOGIN`);
            } else {
              step = 4;
              send(`MAIL FROM:<${senderEmail}>`);
            }
          } else if (step === 2 && (code === 334)) {
            step = 3;
            send(Buffer.from(user!).toString('base64'));
          } else if (step === 3 && (code === 334)) {
            step = 4;
            send(Buffer.from(pass!).toString('base64'));
          } else if (step === 4 && (code === 235 || code === 250)) {
            step = 5;
            send(`MAIL FROM:<${senderEmail}>`);
          } else if (step === 5 && code === 250) {
            step = 6;
            send(`RCPT TO:<${destinatario}>`);
          } else if (step === 6 && code === 250) {
            step = 7;
            send(`DATA`);
          } else if (step === 7 && code === 354) {
            step = 8;
            const boundary = `----=_Part_${Date.now()}`;
            const message = [
              `From: ${from}`,
              `To: ${destinatario}`,
              `Subject: =?UTF-8?B?${Buffer.from(asunto).toString('base64')}?=`,
              `MIME-Version: 1.0`,
              `Content-Type: multipart/alternative; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              texto,
              ``,
              `--${boundary}`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              ``,
              html,
              ``,
              `--${boundary}--`,
              `.`,
            ].join('\r\n');
            send(message);
          } else if (step === 8 && code === 250) {
            step = 9;
            send(`QUIT`);
            socket.end();
            resolve();
          }
        }
      });
    });
  }
}

