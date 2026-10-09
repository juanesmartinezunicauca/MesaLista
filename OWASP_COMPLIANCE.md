# 🛡️ Matriz de Cumplimiento OWASP Top 10 (2021) - Mesa Lista

Resumen ejecutivo de controles de seguridad implementados en **Mesa Lista** frente al estándar **OWASP Top 10 (2021)**, con su respectivo enlace directo a la sección más importante del código fuente.

---

### 1. A01:2021 – Broken Access Control (Control de Acceso / IDOR)
* **Mitigación**: Se previene IDOR validando que los usuarios con rol `cliente` únicamente puedan acceder a sus propios pedidos (`pedido.id_usuario === usuarioAuth.id_usuario`). Si intentan consultar un identificador ajeno, el backend deniega el acceso con `ForbiddenException (403)`.
* **Código Clave**: 📂 [backend/src/modules/domicilios/domicilios.service.ts#L346-L355](backend/src/modules/domicilios/domicilios.service.ts#L346-L355) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/domicilios/domicilios.service.ts#L346-L355)
```typescript
if (usuarioAuth?.rol === RolUsuario.cliente && pedido.id_usuario !== usuarioAuth.id_usuario) {
  throw new ForbiddenException('No tienes autorización para acceder a los datos de este pedido.');
}
```

---

### 2. A02:2021 – Cryptographic Failures (Fallas Criptográficas)
* **Mitigación**: Almacenamiento seguro de contraseñas mediante **Argon2id** (algoritmo recomendado por OWASP) con 64 MB de memoria, 3 iteraciones y sal (*salt*) aleatoria única por usuario, además de tokens JWT firmados criptográficamente.
* **Código Clave**: 📂 [backend/src/modules/usuarios/usuarios.service.ts#L57-L62](backend/src/modules/usuarios/usuarios.service.ts#L57-L62) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/usuarios.service.ts#L57-L62)
```typescript
const passwordHash = await argon2.hash(createUsuarioDto.password, {
  type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4,
});
```

---

### 3. A03:2021 – Injection (Inyecciones SQL / Comandos)
* **Mitigación**: Uso exclusivo de **Prisma ORM** con consultas 100% tipadas y parametrizadas (cero consultas SQL crudas o concatenadas), sumado a un `ValidationPipe` global con lista blanca estricta (`whitelist: true`) que rechaza propiedades no autorizadas.
* **Código Clave**: 📂 [backend/src/main.ts#L49-L59](backend/src/main.ts#L49-L59) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/main.ts#L49-L59)
```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

---

### 4. A04:2021 – Insecure Design (Diseño Inseguro)
* **Mitigación**: Transaccionalidad atómica con `prisma.$transaction` para evitar inconsistencias en movimientos de inventario y caja, y congelamiento inmutable del precio unitario (`DetallePedido.precio_unitario`) al ordenar para evitar alteraciones maliciosas desde el cliente.
* **Código Clave**: 📂 [backend/src/modules/facturacion/facturacion.service.ts#L378-L401](backend/src/modules/facturacion/facturacion.service.ts#L378-L401) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/facturacion/facturacion.service.ts#L378-L401)
```typescript
return this.prisma.$transaction(async (tx) => {
  await tx.pedido.updateMany({ where: { id_factura: id }, data: { id_factura: null } });
  await tx.pago.deleteMany({ where: { id_venta: id } });
  await tx.factura.delete({ where: { id_venta: id } });
});
```

---

### 5. A05:2021 – Security Misconfiguration (Configuración Insegura)
* **Mitigación**: Implementación del middleware **Helmet** para cabeceras HTTP de seguridad (`X-Frame-Options`, `nosniff`, `HSTS`), limitación de tamaño de payload a 2MB para mitigar saturación por DoS, y política de **CORS estricto** que rechaza orígenes no autorizados.
* **Código Clave**: 📂 [backend/src/main.ts#L11-L43](backend/src/main.ts#L11-L43) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/main.ts#L11-L43)
```typescript
app.use(helmet());
app.use(json({ limit: '2mb' }));
app.enableCors({ origin: (origin, callback) => { /* Solo localhost, LAN o dominios autorizados */ } });
```

---

### 6. A06:2021 – Vulnerable and Outdated Components (Componentes Obsoletos)
* **Mitigación**: Depuración del árbol de dependencias eliminando paquetes innecesarios (`@nestjs/mau`) y resolución de dependencias mediante `npm audit fix`, alcanzando **0 vulnerabilidades críticas** en el proyecto.
* **Código Clave**: 📂 [backend/package.json](backend/package.json) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/package.json)

---

### 7. A07:2021 – Identification & Authentication Failures (Autenticación)
* **Mitigación**: Directiva de contraseñas robustas validada en DTOs y formularios de frontend: mínimo **8 caracteres** con requisito de contener al menos **una letra y un número** (`/^(?=.*[a-zA-Z])(?=.*\d)/`). Bloqueo de acceso a cuentas con estado inactivo.
* **Código Clave**: 📂 [backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32](backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/usuarios/dto/create-usuario.dto.ts#L26-L32)
```typescript
@Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
@Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, { message: 'La contraseña debe contener al menos una letra y un número' })
password!: string;
```

---

### 8. A08:2021 – Software and Data Integrity Failures (Integridad de Datos)
* **Mitigación**: Verificación de firmas e integridad de paquetes mediante hashes SHA-512 en `package-lock.json`, y verificación criptográfica asimétrica obligatoria de ID Tokens de terceros con la librería oficial `google-auth-library`.
* **Código Clave**: 📂 [backend/src/modules/auth/auth.service.ts#L108-L125](backend/src/modules/auth/auth.service.ts#L108-L125) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L108-L125)
```typescript
const ticket = await this.googleClient.verifyIdToken({ idToken: googleDto.idToken, audience: googleClientId });
```

---

### 9. A09:2021 – Security Logging and Monitoring (Registro y Monitoreo)
* **Mitigación**: Registro estructurado `[SECURITY_AUDIT]` ante fallos de login, accesos denegados por roles y anulaciones de facturas, protegiendo la privacidad al **no volcar contraseñas ni tokens** a los logs.
* **Código Clave**: 📂 [backend/src/common/guards/roles.guard.ts#L43-L48](backend/src/common/guards/roles.guard.ts#L43-L48) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/common/guards/roles.guard.ts#L43-L48)
```typescript
this.logger.warn(`[SECURITY_AUDIT] Acceso denegado: Usuario '${user?.usuario}' (Rol: ${user?.rol}) intentó acceder a recurso restringido.`);
```

---

### 10. A10:2021 – Server-Side Request Forgery (SSRF)
* **Mitigación**: El backend no procesa ni realiza peticiones HTTP salientes a URLs provistas por usuarios (las imágenes de catálogo se almacenan en base64 de tamaño restringido). Las únicas conexiones externas están limitadas a servidores oficiales de Google OAuth.
* **Código Clave**: 📂 [backend/src/modules/auth/auth.service.ts#L20-L29](backend/src/modules/auth/auth.service.ts#L20-L29) &bull; [Ver en GitHub](https://github.com/juanesmartinezunicauca/MesaLista/blob/fix/mejoras-domicilios-caja-pedidos/backend/src/modules/auth/auth.service.ts#L20-L29)

---

## 🧪 Estado de Verificación
* **Pruebas Unitarias**: ✅ **16 suites / 150 tests aprobados** (`npm run test`).
* **Compilación Backend**: ✅ **0 errores** (`nest build`).
* **Compilación Frontend**: ✅ **0 errores** (`ng build`).
