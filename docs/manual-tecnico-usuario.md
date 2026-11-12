# Manual Técnico y de Usuario — MesaLista POS
## Estándares Internacionales IEEE 1063 e ISO/IEC/IEEE 26514

> **Documento:** Manual Integrado de Ingeniería de Software y Operación de Usuario  
> **Estándar:** IEEE 1063-2001 (Standard for Software User Documentation) e ISO/IEC/IEEE 26514:2018  
> **Sistema:** MesaLista Cloud POS (Restaurante Luigie's)  
> **Versión:** 1.0.0  
> **Fecha de Publicación:** Noviembre 2026  

---

## PARTE I: IDENTIFICACIÓN Y CONTROL DEL DOCUMENTO

### 1.1 Propósito y Alcance
Este manual provee la referencia técnica exhaustiva para administradores de sistemas, desarrolladores y personal operativo del Restaurante Luigie's. Cubre desde el despliegue y mantenimiento de la infraestructura tecnológica hasta los flujos de trabajo cotidianos en caja, comandería y cocina.

### 1.2 Audiencia Objetivo
* **Ingenieros de Operaciones (DevOps/SysAdmin):** Responsables del mantenimiento del servidor, base de datos y despliegue continuo.
* **Super Administrador / Dueño de Restaurante:** Responsable de la gestión de usuarios, auditoría, catálogo y reportes.
* **Cajeros, Meseros y Personal de Cocina:** Usuarios finales que interactúan con las terminales POS en los turnos diarios.

---

## PARTE II: MANUAL TÉCNICO DE INSTALACIÓN Y CONFIGURACIÓN

### 2.1 Requisitos del Sistema

#### 2.1.1 Requisitos de Infraestructura (Servidor Backend & BD)
* **Sistema Operativo:** Linux (Ubuntu 22.04 LTS / Debian 12), Windows Server 2022 o macOS Sonoma.
* **Runtime:** Node.js v20.x o v24.x LTS.
* **Gestor de Paquetes:** npm v10+ o pnpm v9+.
* **Motor de Base de Datos:** PostgreSQL 16.x (Soporte para Neon Serverless o PostgreSQL local).
* **Memoria RAM Mínima:** 1 GB (2 GB recomendado para compilación y tests).
* **Almacenamiento:** 500 MB de espacio libre en disco.

#### 2.1.2 Requisitos de Terminales Cliente (Frontend)
* Navegador Web moderno con soporte ECMAScript 2022+ (Google Chrome v110+, Mozilla Firefox v115+, Safari v16+ o Microsoft Edge).
* Dispositivos móviles, tablets o pantallas táctiles industriales con resolución mínima de 1024x768 píxeles.

---

### 2.2 Variables de Entorno del Sistema

El archivo `.env` en la raíz del directorio `backend/` define los parámetros operativos:

```ini
# Configuración del Servidor HTTP
PORT=3000
NODE_ENV=production

# Base de Datos PostgreSQL (Cadena de conexión con pooling)
DATABASE_URL="postgresql://usuario:password@host:5432/mesalista?schema=public&sslmode=require"

# Seguridad y Autenticación JWT Interna
JWT_SECRET="CAMBIE_ESTO_POR_UN_SECRETO_SEGURO_DE_AL_MENOS_32_CHARS"
JWT_EXPIRES_IN="12h"

# CORS: Dominios y orígenes autorizados (separados por coma)
CORS_ORIGIN="http://localhost:4200,https://mesa-lista-virid.vercel.app"

# Google Identity Services (Client ID obtenido en Google Cloud Console)
GOOGLE_CLIENT_ID="766920876974-oec1t6af3e9dq0ptd6l3e7k0kavieq87.apps.googleusercontent.com"

# Servicio de Correo Transaccional (Brevo API REST - Puerto 443 HTTPS)
FRONTEND_URL="https://mesa-lista-virid.vercel.app"
BREVO_API_KEY="xkeysib-clave-secreta-obtenida-en-brevo"
BREVO_SENDER_EMAIL="mesalistaapp.notificaciones@gmail.com"
```

---

### 2.3 Guía de Instalación Paso a Paso

#### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/juanesteban0907/MesaLista.git
cd MesaLista
```

#### Paso 2: Instalación de Dependencias
```bash
# Instalar backend
cd backend
npm install

# Instalar frontend
cd ../frontend
npm install
```

#### Paso 3: Sincronización de Base de Datos con Prisma
```bash
cd ../backend
npx prisma generate
npx prisma db push
```

#### Paso 4: Inicialización del Super Administrador (Seed)
```bash
npm run db:purge-and-setup
```
*Este comando crea o actualiza la cuenta Super Administrador con el correo institucional configurado y reinicia los consecutivos.*

#### Paso 5: Ejecución en Modo Desarrollo
```bash
# Terminal 1: Iniciar Backend NestJS (Puerto 3000)
cd backend
npm run start:dev

# Terminal 2: Iniciar Frontend Angular 19 (Puerto 4200)
cd frontend
npm start
```

#### Paso 6: Verificación de OpenAPI / Swagger UI
Abrir en el navegador:
`http://localhost:3000/api/docs`

---

### 2.4 Diccionario de Datos Relacional (PostgreSQL)

| Tabla | Clave Primaria | Propósito | Relaciones Principales |
|:---|:---|:---|:---|
| **`usuario`** | `id_usuario` | Personal y clientes registrados | Cajas, Comandas, Facturas, Gastos |
| **`mesa`** | `id_mesa` | Plano físico de mesas de salón | Pedidos, Facturas |
| **`producto`** | `id_producto` | Carta gastronómica e inventario | Ítems de Comanda, Ajustes |
| **`pedido`** | `id_pedido` | Comandas de salón o domicilios | Mesa, Factura, ItemsPedido |
| **`item_pedido`** | `id_item` | Detalle con ingredientes personalizados | Pedido, Producto |
| **`factura`** | `id_venta` | Comprobante contable de cobro | Mesa, Caja, Pagos, Pedidos |
| **`pago`** | `id_pago` | Desglose multimedio de cobro | Factura, MedioPago |
| **`caja`** | `id_caja` | Turno de apertura, balance y cierre | Facturas, Gastos, Usuarios |
| **`gasto`** | `id_gasto` | Salidas menores de dinero | Caja, TipoGasto, MedioPago |
| **`ajuste_inventario`** | `id_ajuste` | Entradas, mermas y arqueos de stock | Producto, Usuario |

---

## PARTE III: MANUAL DE USUARIO POR ROLES OPERATIVOS

```mermaid
graph TD
    Login[Pantalla de Login] -->|Google SSO| CheckRol{Validación de Rol}
    CheckRol -->|Administrador| PanelAdmin[Dashboard General, Personal y Reportes]
    CheckRol -->|Cajero| PanelCaja[Apertura de Caja, Cobro y Arqueo Ciego]
    CheckRol -->|Mesero| PanelMesas[Plano Interactivo y Toma de Comandas]
    CheckRol -->|Cocina| PanelKDS[Pantalla KDS de Preparación]
    CheckRol -->|Cliente| PortalCliente[Carta Digital y Mis Domicilios]
```

---

### 3.1 Rol: Super Administrador

#### 3.1.1 Ingreso al Sistema
1. Ingresar a `https://mesa-lista-virid.vercel.app/login`.
2. Presionar el botón **Continuar con Google**.
3. Seleccionar la cuenta institucional de Super Administrador (`jesmartinez@unicauca.edu.co`).
4. El sistema validará la identidad y redirigirá de inmediato al panel de administración general.

#### 3.1.2 Registro de Nuevos Colaboradores
1. En el menú lateral, seleccionar **Usuarios**.
2. Hacer clic en **+ Nuevo Colaborador**.
3. Completar:
   * **Nombre Completo:** (Ej. *Andrés Mesero*).
   * **Rol Operativo:** Seleccionar `Mesero`, `Cajero` o `Cocina`.
   * **Correo de Entrega (Opcional):** Si se digita un correo, el sistema enviará la invitación automáticamente vía Brevo sin guardarlo en base de datos.
4. Presionar **Guardar**.
5. Se abrirá una tarjeta destacada con el código de invitación generado (Ej. `INV-821943`).
6. Hacer clic en **Copiar código** y compartirlo al colaborador por WhatsApp o mensaje.

---

### 3.2 Rol: Cajero

#### 3.2.1 Apertura de Turno de Caja
1. Al iniciar la jornada, ingresar a la pestaña **Caja**.
2. Si no hay turno abierto, aparecerá la pantalla de **Apertura de Caja**.
3. Contar el dinero en efectivo del cajón e ingresar el **Fondo Base Inicial** (Ej. \$200.000).
4. Presionar **Abrir Turno de Caja**. A partir de ese momento se autoriza el cobro y la facturación.

#### 3.2.2 Facturación y Cobro
1. Ingresar a la sección **Facturas** o pulsar sobre una mesa con comandas listas.
2. El sistema totaliza automáticamente los platos consumidos.
3. Ingresar la propina voluntaria sugerida si el cliente la autoriza.
4. Distribuir el pago en los medios correspondientes (Ej. \$35.000 en Efectivo + \$20.000 en Datáfono).
5. Presionar **Confirmar Pago y Facturar**. La mesa se liberará automáticamente y el ingreso se sumará al turno de caja.

#### 3.2.3 Registro de Gastos Menores
1. En la pestaña **Caja**, presionar **Registrar Gasto / Egreso**.
2. Seleccionar la categoría (Insumos, Aseo, Servicios, Otros), digitar el monto y el concepto.
3. Presionar **Guardar Gasto**. El valor se descontará del saldo teórico en efectivo del turno.

#### 3.2.4 Arqueo Físico Ciego y Cierre de Caja
1. Al finalizar el turno, pulsar **Cerrar Caja**.
2. **Importante:** El sistema no muestra el valor que "debería haber" para evitar manipulaciones.
3. El cajero cuenta físicamente el dinero en efectivo y digita el total exacto.
4. Presionar **Ejecutar Arqueo y Cerrar Turno**.
5. El sistema compara el valor físico contra el balance teórico (Base + Ventas Efectivo - Gastos Efectivo) y emite el acta de cierre indicando si la caja cuadró exacta, o si presentó sobrante o faltante.

---

### 3.3 Rol: Mesero

#### 3.3.1 Toma de Comandas en Salón
1. Ingresar a la vista **Mesas**.
2. Seleccionar una mesa en verde (`Libre`). Cambiará a naranja (`Ocupada`).
3. Buscar y agregar los platos solicitados por los comensales.
4. Para cada plato, es posible indicar personalizaciones (ej. *"Sin cebolla"*, *"Masa crocante"*).
5. Presionar **Enviar Comanda a Cocina**. La orden llegará instantáneamente a la pantalla KDS.

#### 3.3.2 Traslado de Cuentas / Cambio de Mesa
1. Si un cliente solicita cambio de mesa, presionar el botón **Transferir Mesa**.
2. Seleccionar la mesa de destino (debe estar libre).
3. Confirmar la operación. Todas las comandas abiertas se moverán a la nueva mesa.

---

### 3.4 Rol: Cocina (KDS)

1. En la estación de cocina, abrir la vista **Cocina (KDS)**.
2. Las órdenes entrantes se ordenan cronológicamente con temporizador visible.
3. Al comenzar la preparación, tocar la comanda para marcarla en **En Preparación**.
4. Al salir el plato, pulsar **Despachar / Listo**. Se emitirá un aviso visual y sonoro a los meseros.

---

### 3.5 Rol: Cliente (Portal de Domicilios)

1. Abrir `https://mesa-lista-virid.vercel.app/cliente`.
2. Navegar por las categorías de la carta gastronómica.
3. Agregar productos al carrito y presionar **Realizar Pedido**.
4. Ingresar nombre, teléfono de contacto y dirección detallada de entrega.
5. Iniciar sesión con Google para registrar el pedido.
6. Consultar el estado en tiempo real (Recibido -> En Cocina -> En Reparto -> Entregado).

---

## PARTE IV: GUÍA DE SOLUCIÓN DE PROBLEMAS (TROUBLESHOOTING)

| Síntoma o Error | Causa Raíz Probable | Solución Paso a Paso |
|:---|:---|:---|
| **`AggregateError` al despachar invitaciones por correo** | Render Free bloquea conexiones salientes a puertos SMTP 25, 465 y 587. | Configurar `BREVO_API_KEY` y `BREVO_SENDER_EMAIL` en las variables de entorno de Render para que los correos viajen por la API REST HTTPS en el puerto 443. |
| **`Error interno en la base de datos` al iniciar sesión** | Desincronización de columnas entre Prisma y PostgreSQL Neon. | Ejecutar el script SQL de migración en Neon Console agregando `codigo_invitacion` y `codigo_invitacion_expira`. |
| **Acceso Denegado (403 Forbidden) en rutas operativas** | El usuario logueado tiene rol `cliente` o el token expiró. | Cerrar sesión y volver a ingresar. Si es un nuevo empleado, asegurarse de canjear el código de invitación `INV-XXXXXX`. |
| **No se puede facturar una mesa (400 Bad Request)** | No se ha realizado la a
pertura del turno de caja del día. | Ingresar a la sección Caja y realizar la apertura formal ingresando el fondo base inicial. |

