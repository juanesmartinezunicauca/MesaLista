# 🛡️ Matriz de Cumplimiento OWASP Top 10 (2025) - Mesa Lista

Resumen ejecutivo y evidencia técnica de controles de seguridad implementados en **Mesa Lista** frente al estándar **OWASP Top 10:2025**.

> 💡 **Cómo navegar:** Abre este documento en **Vista Previa de Markdown** en tu editor (`Ctrl+Shift+V` en VS Code). Al hacer clic en cada enlace, saltarás directamente a la línea exacta del código fuente o al reporte de evidencia correspondiente.

---

### 1. A01:2025 – Broken Access Control (Control de Acceso, IDOR y SSRF)
* **Mitigación**: Se previene IDOR validando que los usuarios con rol `cliente` únicamente puedan acceder a sus propios pedidos (`pedido.id_usuario === usuarioAuth.id_usuario`), denegando con `ForbiddenException (403)`. Asimismo, `RolesGuard` bloquea accesos no autorizados a nivel de endpoint. Además, se absorbe la mitigación de SSRF al no procesar URLs externas provistas por usuarios (las imágenes se manejan en base64 de tamaño controlado).
* **Código Clave**: 📂 [backend/src/modules/domicilios/domicilios.service.ts (Línea 346)](./backend/src/modules/domicilios/domicilios.service.ts#L346)
```typescript
if (usuarioAuth?.rol === RolUsuario.cliente && pedido.id_usuario !== usuarioAuth.id_usuario) {
  throw new ForbiddenException('No tienes autorización para acceder a los datos de este pedido.');
}
```

---

### 2. A02:2025 – Security Misconfiguration (Configuración Insegura)
* **Mitigación**: Implementación del middleware **Helmet** para forzar cabeceras HTTP de seguridad (`X-Frame-Options`, `nosniff`, `HSTS`), limitación de tamaño de payload a 2MB para mitigar saturación DoS, y política de **CORS estricto** que rechaza de forma determinista orígenes no autorizados.
* **Código Clave**: 📂 [backend/src/main.ts (Línea 12)](./backend/src/main.ts#L12)
```typescript
app.use(helmet());
app.use(json({ limit: '2mb' }));
app.enableCors({ origin: (origin, callback) => { /* Solo localhost, LAN o dominios autorizados */ } });
```

---

### 3. A03:2025 – Software Supply Chain Failures (Cadena de Suministro de Software)
* **Mitigación**: Depuración del árbol de dependencias eliminando librerías huérfanas o deprecadas (`@nestjs/mau`), verificación de hashes criptográficos SHA-512 en `package-lock.json`, fijación estricta de versiones y resolución mediante auditoría continua alcanzando **0 vulnerabilidades críticas o altas**.
* **Código Clave**: 📂 [backend/package.json (Línea 24)](./backend/package.json#L24)

---

### 4. A04:2025 – Cryptographic Failures (Fallas Criptográficas)
* **Mitigación**: Almacenamiento seguro de contraseñas mediante **Argon2id** (algoritmo recomendado por OWASP) con 64 MB de memoria (`m=65536`), 3 iteraciones (`t=3`), paralelismo 4 y sal (*salt*) aleatoria única por usuario, además de tokens JWT firmados criptográficamente y exclusión estricta del campo `password` en respuestas DTO.
* **Código Clave**: 📂 [backend/src/modules/usuarios/usuarios.service.ts (Línea 70)](./backend/src/modules/usuarios/usuarios.service.ts#L70)
```typescript
const passwordHash = await argon2.hash(createUsuarioDto.password, {
  type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4,
});
```

---

### 5. A05:2025 – Injection (Inyecciones y Validación Estricta)
* **Mitigación**: Uso exclusivo de **Prisma ORM** con consultas 100% tipadas y parametrizadas (cero consultas SQL crudas o concatenadas), sumado a un `ValidationPipe` global con lista blanca estricta (`whitelist: true, forbidNonWhitelisted: true`) que rechaza payloads maliciosos (*Mass Assignment* o inyección de propiedades).
* **Código Clave**: 📂 [backend/src/main.ts (Línea 50)](./backend/src/main.ts#L50)
```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

---

### 6. A06:2025 – Insecure Design (Diseño Inseguro y Consistencia)
* **Mitigación**: Transaccionalidad atómica con `prisma.$transaction` para evitar inconsistencias contables en movimientos de inventario, pagos y caja, y congelamiento inmutable del precio unitario (`DetallePedido.precio_unitario`) al ordenar para prevenir alteraciones de precios desde el cliente.
* **Código Clave**: 📂 [backend/src/modules/facturacion/facturacion.service.ts (Línea 378)](./backend/src/modules/facturacion/facturacion.service.ts#L378)
```typescript
return this.prisma.$transaction(async (tx) => {
  await tx.pedido.updateMany({ where: { id_factura: id }, data: { id_factura: null } });
  await tx.pago.deleteMany({ where: { id_venta: id } });
  await tx.factura.delete({ where: { id_venta: id } });
});
```

---

### 7. A07:2025 – Authentication Failures (Fallas de Autenticación)
* **Mitigación**: Directiva de contraseñas robustas validada en DTOs y formularios de frontend: mínimo **8 caracteres** con requisito de contener al menos **una letra y un número** (`/^(?=.*[a-zA-Z])(?=.*\d)/`). Bloqueo de acceso a cuentas con estado inactivo.
* **Código Clave**: 📂 [backend/src/modules/usuarios/dto/create-usuario.dto.ts (Línea 26)](./backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26)
```typescript
@Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
@Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, { message: 'La contraseña debe contener al menos una letra y un número' })
password?: string;
```

---

### 8. A08:2025 – Software and Data Integrity Failures (Integridad de Datos)
* **Mitigación**: Verificación de firmas asimétricas obligatoria de ID Tokens de terceros con la librería oficial `google-auth-library`, previniendo suplantación de identidad o tokens falsificados.
* **Código Clave**: 📂 [backend/src/modules/auth/auth.service.ts (Línea 110)](./backend/src/modules/auth/auth.service.ts#L110)
```typescript
const ticket = await this.googleClient.verifyIdToken({ idToken: googleDto.idToken, audience: googleClientId });
```

---

### 9. A09:2025 – Security Logging and Alerting Failures (Registro y Alerta de Seguridad)
* **Mitigación**: Registro estructurado con prefijo de alerta `[SECURITY_AUDIT]` ante intentos de acceso denegados por rol, fallos de autenticación o anulaciones de facturas, protegiendo la confidencialidad al **no registrar contraseñas ni tokens** en los logs.
* **Código Clave**: 📂 [backend/src/common/guards/roles.guard.ts (Línea 43)](./backend/src/common/guards/roles.guard.ts#L43)
```typescript
this.logger.warn(`[SECURITY_AUDIT] Acceso denegado: Usuario '${user?.usuario}' (Rol: ${user?.rol}) intentó acceder a recurso que requiere: [${requiredRoles.join(', ')}].`);
```

---

### 10. A10:2025 – Mishandling of Exceptional Conditions (Manejo Inadecuado de Condiciones Excepcionales)
* **Mitigación**: Filtro global de excepciones `PrismaExceptionFilter` que intercepta fallos de persistencia (unicidad `P2002`, registros no encontrados `P2025`, violaciones de clave foránea `P2003`), traduciéndolos a respuestas HTTP semánticas (`409 Conflict`, `404 NotFound`, `400 BadRequest`) e impidiendo la fuga de trazas de pila internas (*stack traces*) o schemas de base de datos.
* **Código Clave**: 📂 [backend/src/common/filters/prisma-exception.filter.ts (Línea 12)](./backend/src/common/filters/prisma-exception.filter.ts#L12)
```typescript
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    // Traduce errores internos a respuestas limpias sin fugar esquemas ni crashear el servidor
  }
}
```

---

## 🧪 Evidencias Ejecutables de Cumplimiento (Compliance Testing)

### 📊 Métricas Cuantitativas
* **Batería de Pruebas de Seguridad OWASP Top 10 (2025)**: ✅ **25/25 pruebas aprobadas (100% de tasa de éxito)** en 4.0 segundos.
* **Comando de Ejecución**: `npm run test:owasp` (en la carpeta `backend`).
* **Reporte Visual Interactivo Generado**: 📂 [`backend/reports/owasp-compliance/reporte-owasp-top10.html`](./backend/reports/owasp-compliance/reporte-owasp-top10.html) (Generado con gráficos circulares interactivos, desglose y tiempos mediante `jest-html-reporters`).
* **Pruebas Unitarias Generales del Sistema**: ✅ **16 suites / 150 tests aprobados** (`npm run test`).
* **Vulnerabilidades en Dependencias**: ✅ **0 vulnerabilidades críticas** (`npm audit`).

### 📑 Métricas Cualitativas y Auditoría Dinámica (DAST)
* **Auditoría Dinámica de Vulnerabilidades (DAST)**: Ejecutable con **OWASP ZAP (Zed Attack Proxy)** contra los endpoints de la API (`/api/v1/...`).
* **Guía y Scripts de Auditoría ZAP**: Consulta la 📂 [GUIA_OWASP_ZAP.md](./GUIA_OWASP_ZAP.md) para instrucciones de réplica con Docker o la aplicación de escritorio oficial.
* **Clasificación de Riesgos Detectados**:
  * Riesgo Crítico / Alto: **0 alertas**
  * Riesgo Medio: **0 alertas**
  * Riesgo Bajo / Informativo: Mitigado con cabeceras Helmet (`X-Frame-Options`, `X-Content-Type-Options: nosniff`).
