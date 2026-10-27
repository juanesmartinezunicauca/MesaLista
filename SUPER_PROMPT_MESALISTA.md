# SUPER PROMPT DE ARQUITECTURA E IMPLEMENTACIÓN: "MESALISTA POS & ERP"

Actúa como un **Arquitecto de Software Principal y Desarrollador Fullstack Senior**. Tu objetivo es diseñar, estructurar e implementar desde cero el sistema completo **MesaLista**: una plataforma web moderna, modular y de grado empresarial de punto de venta (POS), comandas interactivas, facturación, control de caja, cocina (KDS), domicilios y reportería analítica para restaurantes.

---

## 1. ESPECIFICACIÓN DEL STACK TECNOLÓGICO Y ARQUITECTURA

Construye una solución desacoplada multi-carpeta (`backend/` y `frontend/`) con los siguientes estándares estrictos:

### Backend:
- **Framework:** NestJS (v11+) con TypeScript en modo estricto.
- **ORM & Base de Datos:** Prisma ORM conectado a PostgreSQL (compatible con Neon / Supabase / Render).
- **Seguridad & Autenticación:** 
  - Google OAuth 2.0 mediante `google-auth-library` (`verifyIdToken`) con identificador criptográfico (`payload.sub`).
  - Hashing de contraseñas de contingencia mediante **Argon2id** (OWASP recommendation: 64 MB memory, 3 iterations, 4 parallelism).
  - Rate limiting defensivo con `@nestjs/throttler` (ThrottlerGuard contra ataques de fuerza bruta).
  - Tokens de sesión JWT firmados (`@nestjs/jwt`, `passport-jwt`).
  - Cabeceras de seguridad HTTP con `helmet`.
- **Integración de Hardware:** Módulo de impresión de tickets térmicos ESC/POS en red local TCP (`node-thermal-printer`).
- **Pruebas Automatizadas:** Jest con mocks completos de Prisma, controladores, servicios y guardias.

### Frontend:
- **Framework:** Angular (v19+) en arquitectura Standalone (sin NgModules) utilizando **Signals** reactivos (`signal`, `computed`, `effect`) e inyección de dependencias moderna (`inject()`).
- **Librería de Componentes:** Angular Material (v19+) con personalización profunda.
- **Estilos:** Vanilla SCSS estructurado con Design Tokens, Mixins, modo oscuro inmersivo y micro-animaciones (Glassmorphism funcional, sin TailwindCSS).
- **Exportación & Reportería:** `jsPDF`, `html2canvas` y exportación limpia a hojas de cálculo Excel (`xlsx`).
- **Pruebas Automatizadas:** Vitest / Angular CLI con cobertura unitaria de componentes, diálogos y servicios.

---

## 2. MODELO DE DATOS COMPLETO (PRISMA SCHEMA)

Implementa exactamente el siguiente esquema relacional en `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum RolUsuario {
  administrador
  cajero
  mesero
  cocina
  cliente
}

enum EstadoUsuario {
  activo
  inactivo
}

enum EstadoMesa {
  libre
  ocupada
}

enum TipoPedido {
  salon
  domicilio
}

enum EstadoPedido {
  enviada
  cerrada
  cancelada
}

enum EstadoCaja {
  abierta
  cerrada
}

enum TipoAjuste {
  Entrada
  Merma
  Arqueo
}

enum EstadoFactura {
  emitida
  anulada
}

model Usuario {
  id_usuario        Int           @id @default(autoincrement())
  nombre            String        @db.VarChar(100)
  usuario           String        @unique @db.VarChar(50)
  email             String?       @unique @db.VarChar(100)
  googleId          String?       @unique @map("google_id") @db.VarChar(100)
  passwordHash      String?       @map("password_hash") @db.VarChar(255)
  codigoInvitacion  String?       @unique @map("codigo_invitacion") @db.VarChar(50)
  rol               RolUsuario
  estado            EstadoUsuario @default(activo)

  ajustesInventario AjusteInventario[]
  pedidos           Pedido[]
  facturas          Factura[]
  cajasApertura     Caja[]        @relation("UsuarioApertura")
  cajasCierre       Caja[]        @relation("UsuarioCierre")
  gastos            Gasto[]

  @@map("usuario")
}

model Mesa {
  id_mesa   Int        @id @default(autoincrement())
  numero    Int        @unique
  estado    EstadoMesa @default(libre)
  pedidos   Pedido[]
  facturas  Factura[]

  @@map("mesa")
}

model Producto {
  id_producto             Int                @id @default(autoincrement())
  nombre                  String             @db.VarChar(100)
  categoria               String             @db.VarChar(50)
  precio_venta            Decimal            @db.Decimal(10, 2)
  costo                   Decimal            @db.Decimal(10, 2)
  ingredientes_removibles String?            @db.VarChar(255)
  cantidad_inventario     Int                @default(0)
  controla_inventario     Boolean            @default(false)
  disponible              Boolean            @default(true)
  imagen                  String?
  ajustesInventario       AjusteInventario[]
  itemsPedido             ItemPedido[]

  @@map("producto")
}

model AjusteInventario {
  id_ajuste   Int        @id @default(autoincrement())
  id_producto Int
  id_usuario  Int
  tipo_ajuste TipoAjuste
  cantidad    Int
  motivo      String     @db.VarChar(255)
  fecha_hora  DateTime   @default(now())

  producto    Producto   @relation(fields: [id_producto], references: [id_producto])
  usuario     Usuario    @relation(fields: [id_usuario], references: [id_usuario])

  @@map("ajuste_inventario")
}

model Pedido {
  id_pedido         Int          @id @default(autoincrement())
  id_factura        Int?
  id_mesa           Int?
  id_usuario        Int
  numero_pedido     Int
  tipo              TipoPedido
  estado            EstadoPedido @default(enviada)
  fecha_hora        DateTime     @default(now())
  observacion       String?      @db.VarChar(255)
  cliente_nombre    String?      @db.VarChar(100)
  cliente_telefono  String?      @db.VarChar(20)
  cliente_direccion String?      @db.VarChar(255)
  cliente_email     String?      @db.VarChar(100)

  items             ItemPedido[]
  factura           Factura?     @relation(fields: [id_factura], references: [id_venta])
  mesa              Mesa?        @relation(fields: [id_mesa], references: [id_mesa])
  usuario           Usuario      @relation(fields: [id_usuario], references: [id_usuario])

  @@index([id_mesa, estado])
  @@index([fecha_hora])
  @@map("pedido")
}

model ItemPedido {
  id_item                Int      @id @default(autoincrement())
  id_pedido              Int
  id_producto            Int
  cantidad               Int
  precio_unitario        Decimal  @db.Decimal(10, 2)
  ingredientes_removidos String?  @db.VarChar(255)
  observacion            String?  @db.VarChar(255)

  pedido                 Pedido   @relation(fields: [id_pedido], references: [id_pedido])
  producto               Producto @relation(fields: [id_producto], references: [id_producto])

  @@map("item_pedido")
}

model Factura {
  id_venta         Int           @id @default(autoincrement())
  id_mesa          Int?
  id_usuario       Int
  id_caja          Int
  valor            Decimal       @db.Decimal(10, 2)
  propina          Decimal       @default(0) @db.Decimal(10, 2)
  valor_total      Decimal       @db.Decimal(10, 2)
  fecha_hora       DateTime      @default(now())
  observacion      String?       @db.VarChar(255)
  estado           EstadoFactura @default(emitida)
  fecha_anulacion  DateTime?
  motivo_anulacion String?       @db.VarChar(255)
  cliente_nombre   String?       @db.VarChar(100)
  cliente_email    String?       @db.VarChar(100)

  caja             Caja          @relation(fields: [id_caja], references: [id_caja])
  mesa             Mesa?         @relation(fields: [id_mesa], references: [id_mesa])
  usuario          Usuario       @relation(fields: [id_usuario], references: [id_usuario])
  pagos            Pago[]
  pedidos          Pedido[]

  @@index([id_caja, fecha_hora])
  @@map("factura")
}

model Pago {
  id_pago       Int       @id @default(autoincrement())
  id_venta      Int
  id_medio_pago Int
  monto         Decimal   @db.Decimal(10, 2)
  fecha_hora    DateTime  @default(now())

  factura       Factura   @relation(fields: [id_venta], references: [id_venta])
  medioPago     MedioPago @relation(fields: [id_medio_pago], references: [id_medio_pago])

  @@map("pago")
}

model Caja {
  id_caja             Int        @id @default(autoincrement())
  id_usuario_apertura Int
  id_usuario_cierre   Int?
  fecha_apertura      DateTime   @default(now())
  fecha_cierre        DateTime?
  valor_inicial       Decimal    @db.Decimal(10, 2)
  valor_final_teorico Decimal?   @db.Decimal(10, 2)
  valor_final_fisico  Decimal?   @db.Decimal(10, 2)
  diferencia          Decimal?   @db.Decimal(10, 2)
  estado              EstadoCaja @default(abierta)
  observacion         String?    @db.VarChar(255)

  usuarioApertura     Usuario    @relation("UsuarioApertura", fields: [id_usuario_apertura], references: [id_usuario])
  usuarioCierre       Usuario?   @relation("UsuarioCierre", fields: [id_usuario_cierre], references: [id_usuario])
  facturas            Factura[]
  gastos              Gasto[]

  @@map("caja")
}

model Gasto {
  id_gasto      Int       @id @default(autoincrement())
  id_tipo_gasto Int
  id_medio_pago Int
  id_caja       Int
  id_usuario    Int
  total         Decimal   @db.Decimal(10, 2)
  fecha_hora    DateTime  @default(now())
  descripcion   String    @db.VarChar(255)
  observacion   String?   @db.VarChar(255)

  caja          Caja      @relation(fields: [id_caja], references: [id_caja])
  medioPago     MedioPago @relation(fields: [id_medio_pago], references: [id_medio_pago])
  tipoGasto     TipoGasto @relation(fields: [id_tipo_gasto], references: [id_tipo_gasto])
  usuario       Usuario   @relation(fields: [id_usuario], references: [id_usuario])

  @@index([id_caja, fecha_hora])
  @@map("gasto")
}

model MedioPago {
  id_medio_pago Int     @id @default(autoincrement())
  nombre        String  @unique @db.VarChar(50)
  pagos         Pago[]
  gastos        Gasto[]

  @@map("medio_pago")
}

model TipoGasto {
  id_tipo_gasto Int     @id @default(autoincrement())
  nombre        String  @unique @db.VarChar(50)
  gastos        Gasto[]

  @@map("tipo_gasto")
}
```

---

## 3. ESPECIFICACIÓN DE MÓDULOS FUNCIONALES

### Módulo 1: Seguridad, Autenticación y Enrolamiento Delegado
1. **Enrolamiento por Token de Un Solo Uso (`One-Time Invitation Token`):**
   - Cuando un administrador crea un colaborador operativo (`mesero`, `cajero`, `cocina`, `administrador`), el sistema **no exige un correo electrónico personal**. En su lugar, genera automáticamente un código unívoco `INV-XXXXXX`.
   - El nuevo empleado accede al login de Google SSO e ingresa su código de invitación en una caja desplegable.
   - El backend valida el token, vincula criptográficamente el `googleId` (`payload.sub`) del colaborador y quema el token (`codigoInvitacion = null`).
   - Los inicios de sesión posteriores son instantáneos con un solo clic en Google SSO.
2. **Compatibilidad Retroactiva y Priorización Operativa:**
   - Para empleados ya registrados sin código o con `email: null`, el backend prioriza la búsqueda por:
     `email` (insensible a mayúsculas `mode: 'insensitive'`), `usuario`, prefijo de usuario y nombre completo.
   - Si el `googleId` estaba vinculado a una cuenta temporal de cliente, lo libera y lo ata a la cuenta legítima de empleado.
   - Redirección inteligente: Roles operativos son dirigidos a `/mesas` (o `/cocina` para personal de cocina); clientes a `/cliente`.

### Módulo 2: Salón y Plano de Mesas Interactivo
- Visualización gráfica de cuadrícula de mesas con estados dinámicos (Libre en verde/neutro, Ocupada en naranja/activo).
- Creación ágil de comandas por mesa, selección de productos, personalización de ingredientes removibles (`sin cebolla`, `sin salsa`) y notas especiales.
- Función de **Transferencia de Mesa** con recálculo en vivo y cierre/facturación directa.

### Módulo 3: Cocina KDS (Kitchen Display System)
- Visor de comandas en tiempo real agrupadas por orden de llegada con temporizador de espera.
- Visualización de observaciones y modificaciones de ingredientes con alertas visuales de alto contraste.
- Botones de transición de estado con actualización reactiva sin recarga de página.

### Módulo 4: Caja, Gastos y Arqueo Ciego
- **Apertura de Turno:** Registro obligatorio de base en efectivo inicial.
- **Flujo en Vivo:** Monitoreo en tiempo real de ingresos por método de pago (Efectivo, Tarjeta, Transferencia) y egresos operacionales (proveedores, nómina diaria, compras menores).
- **Cierre y Arqueo Ciego:** El cajero ingresa el conteo de efectivo físico sin ver el valor teórico; el sistema calcula automáticamente la diferencia (sobrante/faltante) y congela el turno contable.

### Módulo 5: Facturación y Cobro Multimedio
- Liquidación de cuentas con división o pago completo.
- Soporte para propina voluntaria (porcentaje sugerido 10% o monto manual libre).
- Múltiples medios de pago en una sola transacción (`pago`).
- Generación de comprobante digital y envío a cola de impresión térmica ESC/POS.

### Módulo 6: Domicilios y Pedidos Externos
- Tablero Kanban / lista de pedidos a domicilio con KPIs superiores (pedidos en ruta, tiempo promedio, total despachado).
- Captura de datos de entrega: nombre, teléfono, dirección y coordenadas/referencias.
- Despacho y liquidación contra caja en tiempo real.

### Módulo 7: Catálogo e Inventario
- CRUD de productos con categorización, costo de adquisición y precio de venta.
- Control de stock opcional con registro de movimientos clasificados (`Entrada`, `Merma`, `Arqueo`).

### Módulo 8: Analítica, Reportería y Auditoría
- Tablero de control con métricas financieras: Ventas totales, ticket promedio, producto estrella y flujo por método de pago.
- Exportación automática a hojas de cálculo de Excel (`.xlsx`) y reportes vectoriales en PDF de alta fidelidad.
- Auditoría CVSS v3.1 interactiva bajo las 10 directivas del **OWASP Top 10**.

### Módulo 9: Portal Público de Cliente
- Ruta `/cliente` pública y optimizada para dispositivos móviles (auto-pedido o consulta de carta).
- Carrito de compras reactivo protegido por `ClienteCarritoGuard`.
- Blindaje estricto: los roles operativos son redirigidos fuera de la vista de cliente para evitar fugas de contexto.

---

## 4. LINEAMIENTOS DE DISEÑO Y EXPERIENCIA VISUAL (UI/UX)

- **Estética "Cyber-Hospitality" Premium:** Tema oscuro profundo (`#080b11`, `#141618`) con acentos vibrantes de marca en naranja fuego (`#ff6b35`), verde esmeralda (`#10b981`) y azul cobalto (`#2563eb`).
- **Glassmorphism Funcional:** Fondos con `backdrop-filter: blur(16px)`, bordes translúcidos (`rgba(255, 255, 255, 0.08)`) y sombras de profundidad en tarjetas elevadas.
- **Tipografía Moderna:** Fuente `Outfit` o `Inter` desde Google Fonts, jerarquía visual limpia y sin emojis en informes formales o interfaces corporativas.
- **Micro-interacciones:** Indicadores de estado pulsantes (`pulse-dot`), transiciones suaves (`cubic-bezier(0.4, 0, 0.2, 1)`) y retroalimentación táctil en botones.

---

## 5. PLAN DE EJECUCIÓN PASO A PASO

1. **Infraestructura Base:** Generar la estructura de carpetas, inicializar NestJS y Angular, configurar `schema.prisma` y ejecutar migraciones iniciales.
2. **Núcleo de Autenticación:** Configurar el backend con Google OAuth, Argon2id, JWT y el servicio de enrolamiento por tokens de un solo uso.
3. **Módulos Operativos Backend:** Implementar controladores, DTOs con validaciones `class-validator`, y servicios con transacciones Prisma para Mesas, Pedidos, Caja y Facturación.
4. **Design System & Layout Frontend:** Configurar `styles.scss`, design tokens, el componente maestro `Layout`, barra lateral colapsable y barra superior.
5. **Vistas Frontend:** Desarrollar los componentes Standalone con Angular Signals para Login, Plano de Mesas, KDS, Caja, Domicilios, Personal y Reportes.
6. **Batería de Pruebas:** Implementar y ejecutar suites de pruebas unitarias e integración en backend (Jest) y frontend (Vitest) garantizando 100% de éxito.
