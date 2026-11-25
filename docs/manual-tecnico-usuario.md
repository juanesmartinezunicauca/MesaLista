# Manual Técnico y de Usuario — MesaLista POS
## Estándares Internacionales IEEE 1063 e ISO/IEC/IEEE 26514

> **Documento:** Manual Integrado de Ingeniería de Software y Operación de Usuario  
> **Estándar:** IEEE 1063-2001 (Standard for Software User Documentation) e ISO/IEC/IEEE 26514:2018  
> **Sistema:** MesaLista Cloud POS (Restaurante Luigie's)  
> **Versión:** 1.1.0 (Entrega Final)  
> **Fecha de Publicación:** Noviembre 2026

---

## PARTE I: IDENTIFICACIÓN Y CONTROL DEL DOCUMENTO

### 1.1 Propósito y Alcance
Este manual provee la referencia técnica y operativa para administradores de sistemas, desarrolladores y personal del **Restaurante Nocturno Luigie's**. Cubre la instalación, configuración, estructura de base de datos, operación diaria por rol (administrador, cajero, mesero, cocina y cliente) y resolución de incidencias frecuentes.

### 1.2 Audiencia Objetivo
* **Ingenieros de Operaciones (DevOps/SysAdmin):** Despliegue, variables de entorno, base de datos y respaldo.
* **Administrador / Dueño del Restaurante:** Gestión de colaboradores, catálogo, ajustes de inventario, auditoría y reportes BI.
* **Cajeros, Meseros y Personal de Cocina:** Operación diaria en caja, salón, cocina (KDS) y despacho de domicilios.
* **Clientes (y personal en modo cliente):** Consulta de carta digital y realización de pedidos a domicilio en `/cliente`.

---

## PARTE II: MANUAL TÉCNICO DE INSTALACIÓN Y CONFIGURACIÓN

### 2.1 Requisitos del Sistema

#### 2.1.1 Infraestructura (Servidor Backend y Base de Datos)
* **Sistema Operativo:** Linux (Ubuntu 22.04 LTS / Debian 12), Windows 10/11 / Server 2022 o macOS.
* **Runtime:** Node.js v20.x o v24.x LTS.
* **Gestor de Paquetes:** npm v10+.
* **Base de Datos:** PostgreSQL 16 (Neon Serverless o instalación local).
* **Memoria RAM Mínima:** 1 GB (2 GB recomendados para compilación y ejecución de pruebas).
* **Almacenamiento:** 500 MB libres en disco.

#### 2.1.2 Terminales Cliente (Frontend)
* Navegador moderno con soporte ECMAScript 2022+ (Google Chrome 110+, Edge 110+, Firefox 115+, Safari 16+).
* Computador, tablet o dispositivo móvil con conexión estable a internet o red local.

---

### 2.2 Variables de Entorno del Backend (`backend/.env`)

```ini
# Servidor HTTP
PORT=3000
NODE_ENV=production

# Base de Datos PostgreSQL (Neon Serverless o Local)
DATABASE_URL="postgresql://usuario:password@host:5432/mesalista?schema=public&sslmode=require"

# Seguridad JWT interna (mínimo 32 caracteres)
JWT_SECRET="CAMBIE_ESTO_POR_UN_SECRETO_SEGURO_DE_AL_MENOS_32_CHARS"
JWT_EXPIRES_IN="12h"

# CORS (orígenes exactos separados por coma) y URL pública del Frontend
CORS_ORIGIN="http://localhost:4200,https://mesa-lista-virid.vercel.app"
FRONTEND_URL="https://mesa-lista-virid.vercel.app"

# Google Identity Services (Client ID de Google Cloud Console)
GOOGLE_CLIENT_ID="TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

# Correo Transaccional (Brevo REST API v3 — Puerto 443 HTTPS)
BREVO_API_KEY="xkeysib-clave-secreta-obtenida-en-brevo"
BREVO_SENDER_EMAIL="mesalistaapp.notificaciones@gmail.com"

# Hardware opcional: Impresora térmica ESC/POS
PRINTER_INTERFACE="tcp://192.168.1.200:9100"
```

---

### 2.3 Guía de Instalación Paso a Paso

#### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/juanesteban0907/MesaLista.git
cd MesaLista
```

#### Paso 2: Instalar Dependencias
```bash
cd backend
npm install

cd ../frontend
npm install
```

#### Paso 3: Sincronizar Base de Datos con Prisma
```bash
cd ../backend
npx prisma generate
npx prisma db push
```

#### Paso 4: Inicialización de Datos Semilla / Super Administrador
```bash
npx prisma db seed
# O para reinicio limpio y configuración de administrador inicial:
npm run db:purge-and-setup
```

#### Paso 5: Ejecución en Desarrollo
```bash
# Terminal 1 — Backend NestJS 12 (Puerto 3000)
cd backend
npm run start:dev

# Terminal 2 — Frontend Angular 22 (Puerto 4200)
cd frontend
npm start
```

#### Paso 6: Verificación de OpenAPI / Swagger UI
Abrir en el navegador: `http://localhost:3000/api/docs`

---

### 2.4 Diccionario de Datos Relacional (PostgreSQL)

| Tabla | Clave Primaria | Propósito | Relaciones Principales |
|:---|:---|:---|:---|
| **`usuario`** | `id_usuario` | Personal (`googleId`, `email: null`) y clientes (`googleId`, `email`) | Cajas, Pedidos, Facturas, Gastos, Ajustes |
| **`mesa`** | `id_mesa` | Plano físico de mesas de salón (`libre`/`ocupada`) | Pedidos, Facturas |
| **`producto`** | `id_producto` | Carta gastronómica, costos e inventario | ItemsPedido, AjustesInventario |
| **`pedido`** | `id_pedido` | Comandas de salón y pedidos a domicilio | Mesa, Usuario, Factura, ItemsPedido |
| **`item_pedido`** | `id_item` | Detalle de platos con precio unitario congelado | Pedido, Producto |
| **`factura`** | `id_venta` | Comprobante contable de cobro (`emitida`/`anulada`) | Mesa, Caja, Usuario, Pagos, Pedidos |
| **`pago`** | `id_pago` | Desglose por medio de pago (`Efectivo`, `Tarjeta`, `Transferencia`) | Factura, MedioPago |
| **`medio_pago`** | `id_medio_pago` | Catálogo normalizado de medios de pago | Pagos, Gastos |
| **`caja`** | `id_caja` | Turno de apertura, balance teórico y cierre ciego | Facturas, Gastos, Usuarios |
| **`gasto`** | `id_gasto` | Egresos menores registrados en turno de caja | Caja, TipoGasto, MedioPago, Usuario |
| **`tipo_gasto`** | `id_tipo_gasto` | Categorías de egresos operativos | Gastos |
| **`ajuste_inventario`** | `id_ajuste` | Bitácora de entradas, mermas y arqueos de stock | Producto, Usuario |

---

## PARTE III: MANUAL DE USUARIO POR ROLES OPERATIVOS

```mermaid
graph TD
    Login[Pantalla de Login /login] -->|Click en Logo MesaLista| PortalCliente[Carta Digital y Domicilios /cliente]
    Login -->|Google OAuth 2.0| CheckRol{Validación de Rol}
    CheckRol -->|administrador| PanelAdmin[Dashboard, Personal, Catálogo, Caja y Reportes]
    CheckRol -->|cajero| PanelCaja[Caja, Facturación, Mesas y Domicilios]
    CheckRol -->|mesero| PanelMesas[Plano de Mesas, Comandas y Cobro]
    CheckRol -->|cocina| PanelKDS[Pantalla KDS de Cocina]
    CheckRol -->|cliente| PortalCliente
    PanelAdmin -.->|Pedidos personales| PortalCliente
    PanelCaja -.->|Pedidos personales| PortalCliente
    PanelMesas -.->|Pedidos personales| PortalCliente
    PanelKDS -.->|Pedidos personales| PortalCliente
```

---

### 3.1 Rol: Administrador

#### 3.1.1 Ingreso al Sistema
1. Ingresar a `https://mesa-lista-virid.vercel.app/login`.
2. Presionar **Continuar con Google** y seleccionar la cuenta autorizada de administrador.
3. El sistema valida el ID Token de Google y redirige al panel principal.

#### 3.1.2 Registro y Activación de Nuevos Colaboradores
1. En el menú lateral, ingresar a **Usuarios** y pulsar **+ Nuevo Colaborador**.
2. Completar los campos requeridos:
   * **Nombre Completo** (ej. *Andrés Mesero*).
   * **Rol Operativo:** `administrador`, `cajero`, `mesero` o `cocina`.
   * **Correo para envío del código (obligatorio):** se utiliza únicamente para despachar la invitación por correo electrónico vía Brevo y **no se almacena en la base de datos** por política de privacidad.
3. Pulsar **Guardar**. El sistema generará un código criptográfico único de formato `INV-XXXXXXXX` (12 caracteres, vigencia de 48 horas) y lo enviará al correo indicado.
4. El colaborador puede pulsar el enlace directo del correo o escribir manualmente el código completo en la casilla de activación de `/login` y luego iniciar sesión con Google.
5. **Reglas de protección administrativa:** El sistema impide que un administrador se desactive, elimine o degrade a sí mismo, y bloquea cualquier operación que dejaría al sistema sin al menos un `administrador` activo.

#### 3.1.3 Catálogo, Inventario y Reportes BI
* En **Catálogo**, el administrador puede crear/editar productos, definir costos unitarios (campo oculto en consultas públicas) y registrar ajustes trazables (`Entrada`, `Merma`, `Arqueo`).
* En **Reportes**, puede consultar indicadores por rangos de fecha (hasta 366 días), conciliación de caja, ventas por categoría, rentabilidad y operación en cocina, con exportación a **CSV, Excel y PDF**.

---

### 3.2 Rol: Cajero

#### 3.2.1 Apertura de Turno de Caja
1. Ingresar a **Caja** al iniciar la jornada.
2. Contar el efectivo disponible en el cajón, ingresar el **Fondo Base Inicial** y pulsar **Abrir Turno de Caja**.
3. Solo puede existir un turno abierto a la vez; mientras no exista caja abierta, el sistema bloquea facturación y recepción de domicilios.

#### 3.2.2 Facturación y Cobro
1. Seleccionar una mesa ocupada o un domicilio listo para cobro.
2. Verificar el subtotal calculado automáticamente e ingresar la propina voluntaria si aplica.
3. Registrar uno o varios medios de pago (`Efectivo`, `Datáfono/Tarjeta`, `Transferencia/QR`). Si el pago en efectivo incluye cambio/vueltos, el sistema ajusta el asiento en caja al valor exacto facturado.
4. Confirmar el cobro: la factura se emite atómicamente, las comandas pasan a `cerrada` y, en salón, la mesa se libera automáticamente.

#### 3.2.3 Anulación Auditada y Gastos Menores
* **Anular Factura:** Exige motivo de auditoría, conserva el consecutivo, descuenta el monto del balance del turno y libera la mesa si no quedan pedidos activos.
* **Gastos Menores:** Desde **Caja** se registran egresos con categoría, medio de pago y concepto; los gastos en efectivo se descuentan automáticamente del efectivo teórico esperado.

#### 3.2.4 Arqueo Físico Ciego y Cierre de Caja
1. Al finalizar el turno, pulsar **Cerrar Caja**.
2. Contar físicamente el efectivo del cajón e ingresar el valor exacto sin ver previamente el teórico esperado.
3. Confirmar el cierre: el sistema calcula y registra el balance final (`Base + Ventas Efectivo - Gastos Efectivo`) indicando cuadre exacto, sobrante o faltante.

---

### 3.3 Rol: Mesero

#### 3.3.1 Toma de Comandas en Salón
1. En **Mesas**, seleccionar una mesa libre (`Libre`) u ocupada (`Ocupada`).
2. Agregar platos, cantidades, observaciones e ingredientes removidos.
3. Enviar la comanda a cocina: el sistema valida y descuenta stock atómicamente, congela los precios vigentes y envía la orden al panel KDS.
4. Una mesa con comandas activas sin facturar no puede marcarse manualmente como `libre`.

#### 3.3.2 Transferencia de Mesa
1. Pulsar **Transferir Mesa** sobre una mesa ocupada.
2. Seleccionar una mesa destino en estado `libre` y confirmar. Todas las comandas activas se trasladan en una transacción única.

---

### 3.4 Rol: Cocina (KDS)
1. Abrir la vista **Cocina (KDS)** para consultar las órdenes activas ordenadas cronológicamente con notas e ingredientes removidos.
2. Actualizar el estado de preparación conforme avanzan los platos.
3. Por seguridad (anti-IDOR), el rol `cocina` solo accede a los datos operativos necesarios y no puede consultar datos personales de pedidos a domicilio ajenos.

---

### 3.5 Portal Cliente y Pedidos Personales (`/cliente`)
1. Ingresar directamente a `https://mesa-lista-virid.vercel.app/cliente` (o hacer clic en el logo **MesaLista** en `/login`).
2. Explorar la carta digital por categorías o buscador y agregar productos al carrito (`/cliente/carrito`).
3. Iniciar sesión con Google, completar teléfono y dirección de entrega, y confirmar el pedido.
4. Consultar el seguimiento en tiempo real en **Mis Pedidos** (`Pendiente` → `En Preparación` → `En Reparto` → `Entregado`).
5. **Empleados como clientes:** Todo miembro del personal (`administrador`, `cajero`, `mesero`, `cocina`) también puede usar `/cliente` y `/cliente/carrito` para realizar pedidos personales; el sistema los separa automáticamente de los domicilios tomados para clientes en el POS.

---

## PARTE IV: GUÍA DE SOLUCIÓN DE PROBLEMAS (TROUBLESHOOTING)

| Síntoma o Error | Causa Raíz Probable | Solución Paso a Paso |
|:---|:---|:---|
| **Error al enviar código por correo en Render** | Render Free bloquea puertos SMTP salientes (25/465/587) o falta API Key de Brevo. | Configurar `BREVO_API_KEY` y `BREVO_SENDER_EMAIL` en Render para enviar por API REST HTTPS (puerto 443). |
| **Código de invitación rechazado (`401`)** | El código `INV-XXXXXXXX` expiró (48 h), ya fue canjeado o la cuenta está inactiva. | En **Usuarios**, verificar que el colaborador esté `activo` y reenviar un nuevo código de invitación. |
| **Bloqueo por CORS en producción** | El origen del frontend no coincide exactamente con `CORS_ORIGIN` o `FRONTEND_URL`. | Configurar en Render el dominio exacto de Vercel (sin `/` final) en `CORS_ORIGIN` y `FRONTEND_URL`. |
| **No se puede facturar o pedir domicilio (`400`)** | No existe un turno de caja abierto o el servicio de domicilios está pausado. | Ingresar a **Caja** y abrir turno; verificar también el estado de recepción de domicilios. |
| **Error `409 Conflict` al facturar o crear comanda** | Petición duplicada concurrente (mesa/pedido ya facturado o conflicto de inventario). | Recargar la vista actual para sincronizar el estado real de la mesa, factura o inventario. |
| **Error `429 Too Many Requests`** | Se excedió el límite de peticiones por minuto del `ThrottlerGuard`. | Esperar 60 segundos antes de reintentar (protección activa contra fuerza bruta y abuso de correo). |
