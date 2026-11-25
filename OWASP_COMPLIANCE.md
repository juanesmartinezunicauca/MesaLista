# 🛡️ Matriz de Cumplimiento OWASP Top 10 (2025) — MesaLista POS

Resumen ejecutivo y evidencia técnica actualizada de los controles de seguridad implementados en **MesaLista POS** frente al estándar **OWASP Top 10:2025** (actualizado a noviembre de 2026).

> 💡 **Cómo navegar:** Abre este documento en vista previa de Markdown (`Ctrl+Shift+V` en VS Code) para navegar directamente a cada archivo del código fuente y a los reportes HTML generados.

---

### 1. A01:2025 – Broken Access Control (Control de Acceso, IDOR, Privacidad y SSRF)
* **Mitigación:**
  - `RolesGuard` aplica RBAC estricto en cada controlador y emite alertas `[SECURITY_AUDIT]`.
  - Prevención de **IDOR** en domicilios: usuarios con rol `cliente` o `cocina` solo pueden consultar pedidos propios (`pedido.id_usuario === usuarioAuth.id_usuario`), devolviendo `403 Forbidden`.
  - Protección de datos sensibles de negocio: `GET /catalogo/productos` omite el campo `costo` para visitantes públicos y roles no administrativos (solo visible para `administrador` y `cajero`), y modificar `precio_unitario` en facturas queda restringido al rol `administrador`.
  - Prevención de auto-bloqueo administrativo: `UsuariosService` impide que un administrador se desactive, elimine o cambie de rol a sí mismo y bloquea dejar el sistema sin al menos un `administrador` activo.
  - Prevención de escalada de privilegios en facturación: `POST /facturas` rechaza con `409 Conflict` cualquier intento de re-facturar pedidos ya asociados a una factura.
  - Mitigación de **SSRF**: el backend no realiza peticiones hacia URLs arbitrarias provistas por usuarios (las imágenes se gestionan en formato controlado).
* **Código Clave:** 📂 [`backend/src/modules/domicilios/domicilios.service.ts` (Línea 569)](./backend/src/modules/domicilios/domicilios.service.ts#L569)
```typescript
if (
  usuarioAuth &&
  (usuarioAuth.rol === RolUsuario.cliente || usuarioAuth.rol === RolUsuario.cocina) &&
  pedido.id_usuario !== usuarioAuth.id_usuario
) {
  throw new ForbiddenException(
    'No tienes autorización para acceder a los datos de este pedido.',
  );
}
```

---

### 2. A02:2025 – Security Misconfiguration (Configuración Insegura)
* **Mitigación:**
  - Middleware **Helmet** en backend con política CSP compatible con Swagger UI (`/api/docs`), límite de payload en `2mb` para evitar saturación DoS y `trust proxy = 1` para identificar la IP real detrás de Render/Nginx.
  - Política de **CORS estricto por `URL.hostname`** en [`esOrigenCorsPermitido`](./backend/src/common/utils/contabilidad.util.ts), bloqueando suplantaciones como `localhost.atacante.com` y subdominios `*.vercel.app` de terceros.
  - Cabeceras defensivas configuradas también en el despliegue estático de Vercel ([`frontend/vercel.json`](./frontend/vercel.json)): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`.
  - Validación de variables de entorno críticas al arranque mediante **Joi** en [`AppModule`](./backend/src/app.module.ts).
* **Código Clave:** 📂 [`backend/src/main.ts` (Líneas 14–73)](./backend/src/main.ts#L14-L73)

---

### 3. A03:2025 – Software Supply Chain Failures (Cadena de Suministro de Software)
* **Mitigación:** Árbol de dependencias depurado (sin paquetes obsoletos ni huérfanos), lockfiles versionados con integridad criptográfica SHA-512 y verificación estática continua con TypeScript 6.0 estricto y `oxlint`.
* **Código Clave:** 📂 [`backend/package.json`](./backend/package.json) y [`frontend/package.json`](./frontend/package.json)

---

### 4. A04:2025 – Cryptographic Failures (Fallas Criptográficas y Privacidad)
* **Mitigación:**
  - **Cero contraseñas almacenadas:** el sistema opera exclusivamente con **Google OAuth 2.0 / OIDC** (eliminando el riesgo de exposición o fuerza bruta sobre credenciales locales).
  - Generación de códigos de invitación (`INV-XXXXXXXX`, 8 caracteres Base32 Crockford, ~35 bits de entropía) mediante generador criptográfico seguro **`crypto.randomInt`** (CSPRNG), con expiración de 48 horas y canje atómico de un solo uso.
  - **Privacy by Design:** el correo electrónico de colaboradores operativos nunca se persiste en la tabla `usuario` (`email: null`); se usa de forma efímera solo para entregar el código y la identidad queda vinculada por `googleId`.
  - Tokens de sesión JWT firmados con secreto mínimo de 32 caracteres validado al arranque.
* **Código Clave:** 📂 [`backend/src/modules/usuarios/usuarios.service.ts` (Líneas 24–32)](./backend/src/modules/usuarios/usuarios.service.ts#L24-L32)
```typescript
function generarCodigoInvitacionSeguro(): string {
  const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, ALFABETO.length);
    codigo += ALFABETO[idx];
  }
  return `INV-${codigo}`;
}
```

---

### 5. A05:2025 – Injection (Inyecciones y Validación Estricta)
* **Mitigación:**
  - Uso exclusivo de **Prisma ORM 6** con consultas tipadas y parametrizadas (sin SQL concatenado).
  - `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true` contra *Mass Assignment*, más límites explícitos en DTOs (`@Max`, `@MaxLength`, `@ArrayMaxSize`, `@IsEmail`).
  - Middleware dedicado contra inyección de bytes nulos (`\0`, CWE-158) en parámetros de consulta.
  - Sanitización anti-inyección CRLF en cabeceras y *dot-stuffing* RFC 5321 en [`MailService`](./backend/src/modules/mail/mail.service.ts), con timeout HTTP de 8 s en Brevo/Resend.
* **Código Clave:** 📂 [`backend/src/main.ts` (Líneas 40–88)](./backend/src/main.ts#L40-L88)

---

### 6. A06:2025 – Insecure Design (Diseño Inseguro y Consistencia Contable)
* **Mitigación:**
  - Transacciones atómicas `prisma.$transaction` reforzadas con **`pg_advisory_xact_lock`** en consecutivos de pedidos (`730101`), facturación (`730201`) y apertura/cierre de caja (`730301`).
  - Descuento condicional atómico de inventario (`producto.updateMany` con `cantidad_inventario: { gte: cantTotal }`) y cierre atómico de pedidos facturados (`pedido.updateMany` verificando `count === idsPedidos.length`) para imposibilitar stock negativo y doble facturación concurrente.
  - Congelamiento inmutable del `precio_unitario` en `ItemPedido`, bloqueo de cierre de pedidos sin factura y bloqueo de liberación de mesas con comandas sin cobrar.
* **Código Clave:** 📂 [`backend/src/modules/facturacion/facturacion.service.ts` (Líneas 194–245)](./backend/src/modules/facturacion/facturacion.service.ts#L194-L245)

---

### 7. A07:2025 – Authentication Failures (Fallas de Autenticación)
* **Mitigación:**
  - Eliminación total de contraseñas locales en DTOs (`CreateUsuarioDto` y `UpdatePerfilDto` rechazan cualquier propiedad `password`).
  - Validación de estado `activo` antes de quemar códigos de invitación y bloqueo inmediato de cuentas inactivas.
  - **Rate Limiting (`@nestjs/throttler`)** configurado globalmente (30 req/min), con topes estrictos en `POST /auth/google` (`15 req/min`) y `POST /usuarios/:id/enviar-codigo` (`10 req/min`).
* **Código Clave:** 📂 [`backend/src/modules/auth/auth.controller.ts`](./backend/src/modules/auth/auth.controller.ts) y [`backend/src/modules/usuarios/usuarios.controller.ts`](./backend/src/modules/usuarios/usuarios.controller.ts)

---

### 8. A08:2025 – Software and Data Integrity Failures (Integridad de Software y Datos)
* **Mitigación:** Verificación criptográfica asimétrica obligatoria de Google ID Tokens mediante `google-auth-library` (`verifyIdToken`), validando firma JWKS, audiencia (`GOOGLE_CLIENT_ID`), vigencia (`maxExpiry`) y rechazando tokens de acceso (`ya29.`) o JWT malformados.
* **Código Clave:** 📂 [`backend/src/modules/auth/auth.service.ts` (Líneas 112–120)](./backend/src/modules/auth/auth.service.ts#L112-L120)
```typescript
ticket = await this.googleClient.verifyIdToken({
  idToken: tokenLimpio,
  audience: clientIds.length === 1 ? clientIds[0] : clientIds,
  maxExpiry: 86400, // 24 horas máximo de vigencia
});
```

---

### 9. A09:2025 – Security Logging and Alerting Failures (Registro y Auditoría)
* **Mitigación:** Registro estructurado con prefijo `[SECURITY_AUDIT]` en `RolesGuard` y `AuthService` ante accesos denegados por rol, intentos inválidos de autenticación y fallos de configuración, garantizando que **nunca** se escriban tokens JWT ni códigos de invitación en los logs.
* **Código Clave:** 📂 [`backend/src/common/guards/roles.guard.ts` (Líneas 42–49)](./backend/src/common/guards/roles.guard.ts#L42-L49)

---

### 10. A10:2025 – Mishandling of Exceptional Conditions (Manejo Seguro de Excepciones)
* **Mitigación:** Filtro global `PrismaExceptionFilter` que captura `PrismaClientKnownRequestError` (`P2000`, `P2002`, `P2003`, `P2006`, `P2011`, `P2020`, `P2025`, `P2028`, `P2034`), `PrismaClientValidationError`, `PrismaClientUnknownRequestError` (distinguiendo errores UTF-8/null-byte con `400` de fallas de infraestructura con `500`) y `PrismaClientRustPanicError` (`500` con log interno), sin filtrar trazas de pila ni esquemas SQL al cliente.
* **Código Clave:** 📂 [`backend/src/common/filters/prisma-exception.filter.ts` (Líneas 11–74)](./backend/src/common/filters/prisma-exception.filter.ts#L11-L74)

---

## 🧪 Evidencias Ejecutables de Cumplimiento (Actualizado: Noviembre 2026)

### 📊 Métricas Cuantitativas Verificadas
* **Batería OWASP Top 10 (2025):** ✅ **25/25 pruebas aprobadas (100%)** — `npm --prefix backend run test:owasp`.
* **Reporte HTML Interactivo OWASP:** 📂 [`backend/reports/owasp-compliance/reporte-owasp-top10.html`](./backend/reports/owasp-compliance/reporte-owasp-top10.html).
* **Batería Fuzzy / Property-Based (`fast-check` + mutaciones):** ✅ **34/34 pruebas aprobadas (2/2 suites)** — `npm --prefix backend run test:fuzz` ([`reporte-pruebas-fuzzy.html`](./backend/reports/fuzzy-testing/reporte-pruebas-fuzzy.html)).
* **Suite Completa Backend (Jest 30):** ✅ **28/28 suites · 318/318 pruebas aprobadas** (Cobertura global: **70.40%** sentencias, **71.24%** líneas, **69.97%** funciones).
* **Suite Completa Frontend (Vitest 4):** ✅ **18/18 archivos · 114/114 pruebas aprobadas**.
* **Análisis Estático (`tsc`, `ngc`, `oxlint`):** ✅ **0 errores y 0 advertencias** (137 archivos backend + 89 archivos frontend).
* **Auditoría DAST Complementaria:** 📂 [`reports/INFORME_CVSS_OWASP_ZAP.md`](./reports/INFORME_CVSS_OWASP_ZAP.md).
