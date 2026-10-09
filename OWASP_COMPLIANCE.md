# 🛡️ Matriz de Cumplimiento OWASP Top 10 (2021) - Mesa Lista

Este documento detalla técnica y académicamente la implementación de controles de seguridad en **Mesa Lista** frente a los 10 riesgos críticos descritos en el estándar internacional **OWASP Top 10 (2021)**.

Cada sección contiene explicaciones del vector de ataque, la mitigación aplicada, el extracto de código y los **hipervínculos directos a las líneas exactas del repositorio** para facilitar la revisión del docente y la sustentación del proyecto.

---

## 📑 Tabla de Contenidos

1. [A01:2021 - Broken Access Control (Control de Acceso Roto / IDOR)](#a012021---broken-access-control-control-de-acceso-roto--idor)
2. [A02:2021 - Cryptographic Failures (Fallas Criptográficas)](#a022021---cryptographic-failures-fallas-criptográficas)
3. [A03:2021 - Injection (Inyecciones SQL / Comandos)](#a032021---injection-inyecciones-sql--comandos)
4. [A04:2021 - Insecure Design (Diseño Inseguro)](#a042021---insecure-design-diseño-inseguro)
5. [A05:2021 - Security Misconfiguration (Configuración de Seguridad Incorrecta)](#a052021---security-misconfiguration-configuración-de-seguridad-incorrecta)
6. [A06:2021 - Vulnerable and Outdated Components (Componentes Vulnerables y Obsoletos)](#a062021---vulnerable-and-outdated-components-componentes-vulnerables-y-obsoletos)
7. [A07:2021 - Identification and Authentication Failures (Fallas de Identificación y Autenticación)](#a072021---identification-and-authentication-failures-fallas-de-identificación-y-autenticación)
8. [A08:2021 - Software and Data Integrity Failures (Fallas de Integridad de Software y Datos)](#a082021---software-and-data-integrity-failures-fallas-de-integridad-de-software-y-datos)
9. [A09:2021 - Security Logging and Monitoring Failures (Fallas de Registro y Monitoreo de Seguridad)](#a092021---security-logging-and-monitoring-failures-fallas-de-registro-y-monitoreo-de-seguridad)
10. [A10:2021 - Server-Side Request Forgery (SSRF)](#a102021---server-side-request-forgery-ssrf)

---

### A01:2021 - Broken Access Control (Control de Acceso Roto / IDOR)

* **Riesgo**: Los usuarios pueden actuar fuera de sus permisos previstos, acceder a recursos privados de otros usuarios mediante alteración de parámetros identificadores (Insecure Direct Object References - IDOR) o escalar privilegios.
* **Mitigación Implementada**:
  1. **Prevención de IDOR en Pedidos y Domicilios**: En la consulta individual de domicilios (`GET /api/v1/domicilios/:id`), se inyecta el usuario autenticado desde el token JWT. Si el usuario tiene el rol `cliente`, el servicio valida estrictamente que el pedido pertenezca a su identificador de usuario (`pedido.id_usuario === usuarioAuth.id_usuario`). Si intenta acceder a un identificador ajeno, el sistema aborta de inmediato con una excepción `ForbiddenException (403)`.
  2. **Control de Acceso Basado en Roles (RBAC)**: Se utiliza el guard de seguridad `RolesGuard` junto con decoradores de metadatos `@Roles(...)` para impedir que clientes o meseros accedan a funciones administrativas o de arqueo de caja.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/domicilios/domicilios.service.ts#L335-L357](backend/src/modules/domicilios/domicilios.service.ts#L335-L357) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/domicilios/domicilios.service.ts#L335-L357) — *Validación de titularidad de pedido contra IDOR.*
  * 📂 [backend/src/modules/domicilios/domicilios.controller.ts#L108-L120](backend/src/modules/domicilios/domicilios.controller.ts#L108-L120) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/domicilios/domicilios.controller.ts#L108-L120) — *Extracción de sesión segura con `@CurrentUser()`.*
  * 📂 [backend/src/common/guards/roles.guard.ts#L18-L52](backend/src/common/guards/roles.guard.ts#L18-L52) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/common/guards/roles.guard.ts#L18-L52) — *Filtro perimetral de roles permitidos.*
  * 📂 [backend/src/modules/domicilios/domicilios.service.spec.ts#L406-L450](backend/src/modules/domicilios/domicilios.service.spec.ts#L406-L450) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/domicilios/domicilios.service.spec.ts#L406-L450) — *Pruebas unitarias automatizadas contra IDOR.*
* **Extracto de Código**:
```typescript
// backend/src/modules/domicilios/domicilios.service.ts
if (
  usuarioAuth &&
  usuarioAuth.rol === RolUsuario.cliente &&
  pedido.id_usuario !== usuarioAuth.id_usuario
) {
  throw new ForbiddenException(
    'No tienes autorización para acceder a los datos de este pedido.',
  );
}
```

---

### A02:2021 - Cryptographic Failures (Fallas Criptográficas)

* **Riesgo**: Almacenamiento de credenciales en texto plano, uso de algoritmos obsoletos (MD5, SHA1) o debilidades en el cifrado de datos en tránsito y reposo.
* **Mitigación Implementada**:
  1. **Algoritmo de Hashing Argon2id**: Se utiliza **Argon2id** (ganador de la *Password Hashing Competition* y recomendado por las directrices de contraseñas de OWASP) con parámetros de alto costo de memoria y tiempo (`memoryCost: 65536` [64 MB], `timeCost: 3`, `parallelism: 4`) y sal (*salt*) criptográfica aleatoria única por usuario.
  2. **Tokens JWT Criptográficamente Firmados**: Emisión y validación de JSON Web Tokens mediante clave secreta robusta de entorno y expiración acotada para mitigar secuestro de sesión.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/usuarios/usuarios.service.ts#L56-L63](backend/src/modules/usuarios/usuarios.service.ts#L56-L63) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/usuarios.service.ts#L56-L63) — *Generación de hash Argon2id en alta de usuario.*
  * 📂 [backend/src/modules/usuarios/usuarios.service.ts#L226-L233](backend/src/modules/usuarios/usuarios.service.ts#L226-L233) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/usuarios.service.ts#L226-L233) — *Hashing Argon2id en actualización de credenciales.*
  * 📂 [backend/src/modules/auth/auth.service.ts#L63-L71](backend/src/modules/auth/auth.service.ts#L63-L71) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L63-L71) — *Verificación criptográfica segura con `argon2.verify()`.*
  * 📂 [backend/src/modules/auth/auth.service.ts#L93-L100](backend/src/modules/auth/auth.service.ts#L93-L100) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L93-L100) — *Firma de tokens JWT criptográficos.*
* **Extracto de Código**:
```typescript
// backend/src/modules/usuarios/usuarios.service.ts
const passwordHash = await argon2.hash(createUsuarioDto.password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iteraciones
  parallelism: 4,
});
```

---

### A03:2021 - Injection (Inyecciones SQL / Comandos)

* **Riesgo**: Datos suministrados por el atacante son interpretados como comandos o consultas por el intérprete (ej. SQL Injection, NoSQL Injection, OS Injection).
* **Mitigación Implementada**:
  1. **Consultas Parametrizadas con Prisma ORM**: Todo el acceso a la base de datos PostgreSQL se realiza mediante el motor ORM Prisma, el cual compila todas las consultas utilizando sentencias preparadas y parámetros tipados. No existe ninguna sentencia SQL cruda ni concatenaciones con `$queryRaw` o `$executeRaw`.
  2. **Validación de Entradas y Lista Blanca (Whitelist)**: `ValidationPipe` global configurado con `whitelist: true` y `forbidNonWhitelisted: true`, eliminando y rechazando cualquier propiedad ajena no declarada en los Data Transfer Objects (DTOs).
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/main.ts#L49-L59](backend/src/main.ts#L49-L59) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/main.ts#L49-L59) — *Configuración global de ValidationPipe con Whitelist.*
  * 📂 [backend/src/modules/catalogo/catalogo.service.ts](backend/src/modules/catalogo/catalogo.service.ts) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/catalogo/catalogo.service.ts) — *Consultas 100% tipadas y parametrizadas sin SQL crudo.*
* **Extracto de Código**:
```typescript
// backend/src/main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // Remueve cualquier campo fuera del DTO
    forbidNonWhitelisted: true, // Lanza error 400 ante parámetros sospechosos
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

---

### A04:2021 - Insecure Design (Diseño Inseguro)

* **Riesgo**: Defectos en el diseño de la arquitectura que no pueden arreglarse solo con una buena implementación (ej. manipulación de precios desde el cliente, condiciones de carrera en inventario o transacciones financieras inconsistentes).
* **Mitigación Implementada**:
  1. **Congelamiento Inmutable de Precios (Price Snapshotting)**: Al crear un pedido en mesa o a domicilio, el backend consulta el precio vigente directamente en la base de datos y lo congela en el registro `DetallePedido.precio_unitario`. Las modificaciones posteriores en el catálogo o alteraciones maliciosas desde el cliente no alteran el total a facturar.
  2. **Atomicidad y Consistencia Financiera**: Las operaciones de caja, inventario, cierre de pedidos y anulación de facturas se encapsulan en transacciones atómicas `prisma.$transaction(async (tx) => ...)`, garantizando que si una etapa falla, toda la transacción efectúa rollback.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/facturacion/facturacion.service.ts#L378-L401](backend/src/modules/facturacion/facturacion.service.ts#L378-L401) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/facturacion/facturacion.service.ts#L378-L401) — *Transacción atómica segura en anulación y restitución de facturas.*
  * 📂 [backend/src/modules/domicilios/domicilios.service.ts#L100-L135](backend/src/modules/domicilios/domicilios.service.ts#L100-L135) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/domicilios/domicilios.service.ts#L100-L135) — *Congelamiento de precios unitarios y reserva atómica de inventario.*

---

### A05:2021 - Security Misconfiguration (Configuración de Seguridad Incorrecta)

* **Riesgo**: Cabeceras de seguridad ausentes, orígenes de CORS excesivamente permisivos (`*` con credenciales), manejo de errores que expone la arquitectura interna o cargas de payload sin límite que propician ataques de denegación de servicio (DoS).
* **Mitigación Implementada**:
  1. **Integración de Helmet**: Middleware para inyección de cabeceras HTTP defensivas (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security [HSTS]`, entre otras).
  2. **CORS Estricto**: Restricción de orígenes permitidos únicamente al dominio local de desarrollo, LAN autorizada y subdominios en producción Vercel (`.vercel.app`). Peticiones de otros orígenes son rechazadas con error explícito.
  3. **Límite de Payload Reducido (DoS Protection)**: Se fijó el límite de `express.json` y `urlencoded` a 2MB para admitir imágenes de productos pero impedir saturación de memoria en el servidor Node.js.
  4. **Filtro Global de Excepciones**: `PrismaExceptionFilter` captura errores internos de base de datos y responde códigos HTTP estándar sin exponer esquemas ni trazas de base de datos al cliente.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/main.ts#L11-L16](backend/src/main.ts#L11-L16) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/main.ts#L11-L16) — *Middleware Helmet y límite de 2MB de payload.*
  * 📂 [backend/src/main.ts#L18-L43](backend/src/main.ts#L18-L43) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/main.ts#L18-L43) — *Política restrictiva de orígenes CORS.*
  * 📂 [backend/src/common/filters/prisma-exception.filter.ts](backend/src/common/filters/prisma-exception.filter.ts) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/common/filters/prisma-exception.filter.ts) — *Filtro de excepciones para prevenir fugas de información.*
* **Extracto de Código**:
```typescript
// backend/src/main.ts
app.use(helmet());
app.use(json({ limit: '2mb' }));
app.use(urlencoded({ extended: true, limit: '2mb' }));

app.enableCors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.vercel.app') ||
      configuredOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Acceso no permitido por política CORS'), false);
  },
  credentials: true,
});
```

---

### A06:2021 - Vulnerable and Outdated Components (Componentes Vulnerables y Obsoletos)

* **Riesgo**: Uso de librerías, dependencias o paquetes de terceros desactualizados con vulnerabilidades conocidas y publicadas en bases de datos CVE.
* **Mitigación Implementada**:
  1. **Depuración de Dependencias**: Se desinstaló la librería innecesaria `@nestjs/mau`, eliminando 37 paquetes transitivos que contenían versiones vulnerables de `undici`.
  2. **Auditoría Automatizada**: Se aplicó `npm audit fix`, alcanzando **0 vulnerabilidades críticas** en el backend.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/package.json](backend/package.json) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/package.json) — *Dependencias de producción depuradas y protegidas.*
  * 📂 [backend/package-lock.json](backend/package-lock.json) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/package-lock.json) — *Árbol de dependencias resuelto sin paquetes críticos.*

---

### A07:2021 - Identification and Authentication Failures (Fallas de Identificación y Autenticación)

* **Riesgo**: Permisividad ante contraseñas débiles o por defecto, ataques de fuerza bruta y debilidad en los mecanismos de sesión.
* **Mitigación Implementada**:
  1. **Requisitos de Complejidad de Contraseña**: Tanto en backend como en frontend, las contraseñas exigen un mínimo de **8 caracteres** y deben contener al menos **una letra y un número** (`/^(?=.*[a-zA-Z])(?=.*\d)/`).
  2. **Bloqueo de Cuentas Inactivas**: Al autenticar, el backend rechaza de forma estricta credenciales de cuentas marcadas con `estado: inactivo`.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32](backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32) — *Validación de contraseña en creación de usuario.*
  * 📂 [backend/src/modules/usuarios/dto/update-usuario.dto.ts#L23-L29](backend/src/modules/usuarios/dto/update-usuario.dto.ts#L23-L29) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/dto/update-usuario.dto.ts#L23-L29) — *Validación en actualización de usuarios.*
  * 📂 [backend/src/modules/auth/dto/update-perfil.dto.ts#L10-L16](backend/src/modules/auth/dto/update-perfil.dto.ts#L10-L16) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/dto/update-perfil.dto.ts#L10-L16) — *Validación en cambio de contraseña desde perfil propio.*
  * 📂 [frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.ts#L91-L96](frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.ts#L91-L96) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.ts#L91-L96) — *Validadores reactivos de contraseña en formulario Angular.*
  * 📂 [frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.html#L120-L127](frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.html#L120-L127) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/frontend/src/app/features/usuarios/usuario-dialog/usuario-dialog.html#L120-L127) — *Mensajes de retroalimentación de complejidad al usuario.*
* **Extracto de Código**:
```typescript
// backend/src/modules/usuarios/dto/create-usuario.dto.ts
@IsString({ message: 'La contraseña debe ser una cadena de texto' })
@IsNotEmpty({ message: 'La contraseña es obligatoria' })
@Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
@Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
  message: 'La contraseña debe contener al menos una letra y un número',
})
password!: string;
```

---

### A08:2021 - Software and Data Integrity Failures (Fallas de Integridad de Software y Datos)

* **Riesgo**: Ejecución de código no confiable, manipulación de dependencias mediante canales no verificados o aceptación de tokens y certificados de terceros sin comprobación criptográfica.
* **Mitigación Implementada**:
  1. **Integridad de Paquetes en Dependencias**: Uso de `package-lock.json` con firmas criptográficas `SHA-512` (subresource integrity / integrity hashes).
  2. **Verificación Criptográfica de Tokens Google OAuth 2.0**: Al recibir un login federado con Google, se valida la firma asimétrica del token de identidad directamente contra las llaves públicas de Google utilizando `OAuth2Client.verifyIdToken`.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/auth/auth.service.ts#L108-L125](backend/src/modules/auth/auth.service.ts#L108-L125) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L108-L125) — *Verificación de firma criptográfica y audiencia de Google ID Token.*
  * 📂 [backend/package-lock.json](backend/package-lock.json) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/package-lock.json) — *Hashes de integridad SHA-512.*

---

### A09:2021 - Security Logging and Monitoring Failures (Fallas de Registro y Monitoreo de Seguridad)

* **Riesgo**: Falta de auditoría de eventos de seguridad que impida detectar o investigar brechas, intentos de inicio de sesión sospechosos o modificaciones críticas en datos del negocio.
* **Mitigación Implementada**:
  1. **Trazas Estructuradas `[SECURITY_AUDIT]`**: Se implementó el servicio de logs con prefijo estándar para eventos de alta sensibilidad.
  2. **Protección de Datos Sensibles en Logs**: Los logs registran únicamente el nombre de usuario, rol, identificador y resultado de la acción. **Nunca se imprimen contraseñas en texto plano ni tokens JWT**.
  3. **Eventos Auditados**:
     * Intentos fallidos y accesos exitosos en autenticación básica y OAuth.
     * Intentos de acceso denegados por falta de rol o permisos en `RolesGuard`.
     * Anulaciones / eliminaciones de facturas en el turno de caja.
* **Archivos e Hipervínculos al Código**:
  * 📂 [backend/src/modules/auth/auth.service.ts#L44-L95](backend/src/modules/auth/auth.service.ts#L44-L95) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L44-L95) — *Auditoría de autenticación y fallos de credenciales.*
  * 📂 [backend/src/common/guards/roles.guard.ts#L32-L48](backend/src/common/guards/roles.guard.ts#L32-L48) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/common/guards/roles.guard.ts#L32-L48) — *Auditoría de acceso no autorizado y escalamiento de roles.*
  * 📂 [backend/src/modules/facturacion/facturacion.service.ts#L394-L397](backend/src/modules/facturacion/facturacion.service.ts#L394-L397) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/facturacion/facturacion.service.ts#L394-L397) — *Auditoría financiera en anulación de facturas.*
* **Extracto de Código**:
```typescript
// backend/src/common/guards/roles.guard.ts
this.logger.warn(
  `[SECURITY_AUDIT] Acceso denegado: Usuario '${user?.usuario || user?.id_usuario}' (Rol: ${user.rol}) intentó acceder a recurso que requiere: [${requiredRoles.join(', ')}].`,
);
```

---

### A10:2021 - Server-Side Request Forgery (SSRF)

* **Riesgo**: El servidor web procesa o descarga una URL provista por el usuario sin validar, permitiendo al atacante forzar al servidor a enviar peticiones HTTP a la red interna o servicios en la nube.
* **Mitigación Implementada**:
  1. **Superficie de Peticiones Salientes Nula**: La API REST de Mesa Lista no ofrece endpoints donde el usuario pueda suministrar URLs externas para ser consumidas o descargadas por el backend (las imágenes de productos se almacenan directamente en base64 de tamaño acotado).
  2. **Comunicaciones Restringidas a Destinos Confiables**: La única llamada HTTP externa saliente está codificada de forma fija hacia la biblioteca oficial de Google OAuth 2.0.

---

## 🚀 Resumen de Verificación y Pruebas Automatizadas

| Suite de Prueba | Resultado | Cobertura |
|---|---|---|
| **Jest Backend Unit Tests** | ✅ **16 passed / 150 tests** | Validación de IDOR, RolesGuard, Argon2id Hashing, DTOs y Servicios. |
| **NestJS Build** | ✅ **0 errores** | Compilación estricta TypeScript de producción. |
| **Angular Frontend Build** | ✅ **0 errores** | Compilación de bundle de producción con tree-shaking y validación AOT. |
