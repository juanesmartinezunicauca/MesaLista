# MesaLista POS 🍽️ — Sistema Integral de Gestión Restaurantera y Punto de Venta

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-ea2845?style=flat&logo=nestjs)](https://nestjs.com/)
[![Angular](https://img.shields.io/badge/Frontend-Angular%2019%2B-dd0031?style=flat&logo=angular)](https://angular.dev/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%20ORM-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![OpenAPI](https://img.shields.io/badge/Docs-OpenAPI%203.0%20%2F%20Swagger-85ea2d?style=flat&logo=swagger)](http://localhost:3000/api/docs)
[![Arc42](https://img.shields.io/badge/Architecture-Arc42%20v8.2-blue)](docs/arquitectura/arc42.md)
[![IEEE](https://img.shields.io/badge/Standard-IEEE%201063%20%7C%20ISO%2026514-informational)](docs/manual-tecnico-usuario.md)
[![Security](https://img.shields.io/badge/Security-OWASP%20Top%2010-brightgreen)](OWASP_COMPLIANCE.md)

---

## 📌 1. Visión General del Sistema

**MesaLista POS** es una solución de Punto de Venta y Gestión Operativa diseñada bajo un enfoque híbrido **Cloud & Local-First (LAN)** para locales gastronómicos de alta rotación, implementada y validada en su fase piloto con el **Restaurante Nocturno Luigie's** (Popayán, Cauca, Colombia).

El sistema centraliza y sincroniza en tiempo real las operaciones clave del restaurante:
- **Gestión de Salón y Mesas:** Plano interactivo visual, control de estados (libre, ocupada, atendida, sucia), cambio de ubicación y comandería rápida por mesero.
- **Cocina y Barra (KDS - Kitchen Display System):** Cola visual de pedidos en tiempo real con tiempos de preparación, estados de cocción y despachos parciales.
- **Domicilios y Pedidos Externos:** Registro de clientes de domicilio, cálculo de costos de despacho, trazabilidad de ruta y panel público de recepción de pedidos.
- **Arqueo y Control de Turnos de Caja:** Apertura con base inicial, registro de egresos/gastos menores en tiempo real, arqueo ciego o supervisado y balance de cierre.
- **Facturación y Liquidación:** Múltiples medios de pago (efectivo, datáfono, transferencia QR), gestión voluntaria de propina (10%), anulación auditada y soporte de impresión térmica ESC/POS.
- **Autenticación Federada de Alta Seguridad:** Acceso exclusivo corporativo mediante **Google OAuth 2.0 (Identity Services)** con enrolamiento por tokens efímeros y control de acceso basado en roles (**RBAC**).

---

## 📚 2. Estándares y Documentación Técnica del Repositorio

El proyecto implementa los estándares internacionales de arquitectura, especificación de APIs y documentación de software:

| Documento | Estándar / Marco | Descripción |
|---|---|---|
| [**Swagger UI Interactivo**](http://localhost:3000/api/docs) | **OpenAPI Specification 3.0** | Catálogo vivo de endpoints, esquemas DTO, ejemplos y autenticación Bearer interactiva en `/api/docs`. |
| [**Arc42 Architectural Blueprint**](docs/arquitectura/arc42.md) | **Arc42 v8.2** | Especificación integral de arquitectura: contexto, bloques C4, vistas de ejecución, ADRs y análisis de calidad ATAM. |
| [**Manual Técnico y de Usuario**](docs/manual-tecnico-usuario.md) | **IEEE 1063 & ISO/IEC/IEEE 26514** | Guía de instalación paso a paso, diccionario de base de datos, manual por roles operativos y resolución de fallos. |
| [**Guía de Sustentación de Autenticación**](docs/sustentacion-auth.md) | **OAuth 2.0 RFC 6749 & OIDC** | Trazabilidad archivo por archivo del flujo de autenticación Google, mitigación Anti-Account Takeover y banco de preguntas para evaluación oral. |
| [**Matriz de Cumplimiento OWASP**](OWASP_COMPLIANCE.md) | **OWASP Top 10 (2025/2026)** | Auditoría técnica de mitigación de vulnerabilidades (Inyecciones, Broken Auth, SSRF, DoS, Exposición de Datos). |

---

## 🛠️ 3. Stack Tecnológico

```mermaid
flowchart LR
    subgraph Client["Frontend (SPA)"]
        A[Angular 19 Standalone] --> B[Signals & RxJS Reactive State]
        B --> C[Tailwind CSS & SCSS]
        C --> D[Google Identity Services GIS]
    end
    
    subgraph Server["Backend API"]
        E[NestJS 11+ REST] --> F[Prisma ORM 6]
        E --> G[Passport JWT & Class-Validator]
        E --> H[Swagger OpenAPI 3.0]
        E --> I[Brevo API Mailer]
    end

    subgraph Data["Infraestructura & Datos"]
        J[(PostgreSQL 16 Neon / Local)]
        K[Docker & Docker Compose]
        L[Impresoras ESC/POS TCP/USB]
    end

    Client -->|HTTPS / JSON + Bearer JWT| Server
    Server -->|Pool TCP / SSL| Data
```

- **Frontend:** Angular 19/20+, TypeScript 5+, RxJS 7+, Standalone Components, Reactive Forms, SCSS modular.
- **Backend:** NestJS 11+, Node.js 20+ LTS, TypeScript 5+, Passport.js, Helmet, Express.
- **Capa de Persistencia:** Prisma ORM, PostgreSQL 16 (Compatible con Neon Cloud Serverless y PostgreSQL Local).
- **Seguridad & Comunicaciones:** Google Identity Services (`@google/accounts`), JWT (`RS256/HS256`), Brevo REST API v3 (Emails transaccionales sin bloqueo de puertos SMTP).
- **Hardware Integrado:** Soporte para impresoras de recibos térmicas de 80mm y 58mm vía socket TCP/LAN o driver nativo.

---

## 📋 4. Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instalado:
- **Node.js:** v20.x LTS o superior ([Descargar](https://nodejs.org/))
- **npm:** v9.x o superior
- **Base de Datos PostgreSQL:** v15+ en local **O** una cadena de conexión a un clúster PostgreSQL en la nube ([Neon.tech](https://neon.tech), Supabase, etc.).
- **Docker & Docker Compose** *(Opcional, si deseas levantar todo el entorno mediante contenedores)*.
- **Google Cloud Console:** Client ID configurado en OAuth 2.0 Web Client con orígenes autorizados `http://localhost:4200`.

---

## ⚙️ 5. Configuración de Variables de Entorno

### 5.1 Backend (`backend/.env`)
Copia la plantilla `backend/.env.example` como `backend/.env`:

```bash
# Windows PowerShell:
Copy-Item backend/.env.example backend/.env

# Linux / macOS / Bash:
cp backend/.env.example backend/.env
```

Edita `backend/.env` con tus credenciales reales (este archivo está en `.gitignore` y **nunca** se versiona):

```ini
# Servidor HTTP
PORT=3000
NODE_ENV=development

# Base de datos PostgreSQL (Ejemplo Neon Cloud o Local)
DATABASE_URL="postgresql://usuario:contraseña@ep-ejemplo.us-east-2.aws.neon.tech/mesalista?sslmode=require"

# Seguridad JWT (Generar con: openssl rand -hex 32)
JWT_SECRET="CAMBIE_ESTO_POR_UNA_CLAVE_ALEATORIA_SUPER_SEGURA_DE_32_BYTES"
JWT_EXPIRES_IN="12h"

# CORS (Orígenes autorizados separados por coma)
CORS_ORIGIN="http://localhost:4200"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="123456789012-ejemplo.apps.googleusercontent.com"

# Impresora térmica ESC/POS (opcional)
PRINTER_INTERFACE="tcp://192.168.1.200:9100"

# Despacho de Correo Electrónico (Brevo REST API - Invitaciones de Empleados)
BREVO_API_KEY="xkeysib-tu-api-key-de-brevo"
BREVO_SENDER_EMAIL="notificaciones@tudominio.com"
```

### 5.2 Frontend (`frontend/src/environments/`)
Configura las variables públicas en `frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  googleClientId: '123456789012-ejemplo.apps.googleusercontent.com',
};
```

---

## 🚀 6. Guía de Instalación y Ejecución Local

### Paso 1: Dependencias del Backend y Base de Datos
En tu primera terminal:
```bash
cd backend
npm install

# Generar el cliente tipado de Prisma
npx prisma generate

# Sincronizar el modelo relacional en PostgreSQL
npx prisma db push

# Poblar datos iniciales (Mesas del 1 al 6 y usuario super-admin inicial)
npx prisma db seed

# Iniciar servidor en desarrollo con hot-reload
npm run start:dev
```
> El backend quedará escuchando en: `http://localhost:3000`  
> Documentación interactiva Swagger: `http://localhost:3000/api/docs`

### Paso 2: Dependencias y Ejecución del Frontend
En tu segunda terminal:
```bash
cd frontend
npm install

# Iniciar la SPA de Angular
npm start
```
> La interfaz gráfica estará disponible en: `http://localhost:4200`

---

## 🐳 7. Ejecución con Docker Compose (Todo en Uno)

Si prefieres levantar el stack completo sin instalar PostgreSQL ni Node en tu máquina anfitriona:

```bash
# Iniciar todos los servicios (Base de datos PostgreSQL, Backend NestJS y Frontend Nginx)
docker compose up --build -d

# Ver logs en vivo
docker compose logs -f

# Detener los contenedores
docker compose down
```

Puertos expuestos por Docker:
- **Frontend Web:** `http://localhost:80`
- **Backend API & Swagger:** `http://localhost:3000/api/v1` y `http://localhost:3000/api/docs`
- **PostgreSQL:** `localhost:5432`

---

## 🔐 8. Roles de Usuario y Flujo de Autenticación

El acceso al sistema está blindado mediante **Google OAuth 2.0**:

```mermaid
flowchart TD
    A[Usuario pulsa 'Iniciar sesión con Google'] --> B[Google One Tap / GIS Popup]
    B -->|ID Token firmado JWT| C[Frontend envía ID Token a POST /auth/google]
    C --> D[Backend valida firma criptográfica con Google Auth Library]
    D --> E{¿Email existe en tabla 'usuario'?}
    E -->|No| F[401 Unauthorized: Usuario no registrado en nómina]
    E -->|Sí, pero inactivo| G[401 Unauthorized: Cuenta desactivada]
    E -->|Sí y activo| H[Enlaza google_id si es primera vez]
    H --> I[Backend emite JWT con id_usuario, rol y nombre]
    I --> J[Frontend almacena JWT y redirige según Rol]
```

### Roles del Sistema (RBAC)
- **`super_admin` / `administrador`:** Acceso integral a métricas, catálogo, nómina de empleados, caja y reportes.
- **`cajero`:** Gestión exclusiva del turno de caja, egresos menores, arqueo físico y cobro de pedidos.
- **`mesero`:** Asignación visual de comandas a mesas, traslado de cuentas y visualización de pedidos activos.
- **`cocinero`:** Panel KDS en cocina, cambio de estados a "en preparación" y "listo para entregar".
- **`domiciliario`:** Despacho, trazabilidad de pedidos fuera de salón y confirmación de entrega.

---

## 📡 9. Ejemplos de Uso de la API (cURL / HTTP)

Todos los endpoints (excepto el login de Google y webhook/recepción pública) requieren la cabecera `Authorization: Bearer <TOKEN_JWT>`.

### 9.1 Autenticación con Google OAuth
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEy..."
  }'
```
**Respuesta (`201 Created`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id_usuario": 1,
    "nombre": "Juan Esteban Martínez",
    "usuario": "admin",
    "email": "jesmartinez@unicauca.edu.co",
    "rol": "administrador",
    "estado": "activo"
  }
}
```

---

### 9.2 Consultar Estado Operativo de Caja
```bash
curl -X GET http://localhost:3000/api/v1/caja/estado \
  -H "Authorization: Bearer $TOKEN"
```
**Respuesta (`200 OK`):**
```json
{
  "cajaAbierta": true,
  "caja": {
    "id_caja": 14,
    "monto_apertura": 150000.00,
    "total_ventas_efectivo": 420000.00,
    "total_gastos": 35000.00,
    "saldo_esperado": 535000.00,
    "fecha_apertura": "2026-11-12T18:00:00.000Z",
    "estado": "abierta"
  }
}
```

---

### 9.3 Listar Mesas del Salón
```bash
curl -X GET http://localhost:3000/api/v1/mesas \
  -H "Authorization: Bearer $TOKEN"
```
**Respuesta (`200 OK`):**
```json
[
  {
    "id_mesa": 1,
    "numero_mesa": "Mesa 1",
    "capacidad": 4,
    "estado": "libre",
    "posicion_x": 120,
    "posicion_y": 80
  },
  {
    "id_mesa": 2,
    "numero_mesa": "Mesa 2",
    "capacidad": 6,
    "estado": "ocupada",
    "posicion_x": 280,
    "posicion_y": 80
  }
]
```

---

### 9.4 Crear una Comanda / Pedido de Mesa
```bash
curl -X POST http://localhost:3000/api/v1/pedidos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_mesa": 2,
    "tipo_pedido": "mesa",
    "observaciones": "Sin cebolla en la hamburguesa especial",
    "items": [
      {
        "id_producto": 5,
        "cantidad": 2,
        "notas": "Término medio"
      },
      {
        "id_producto": 12,
        "cantidad": 2,
        "notas": "Con hielo"
      }
    ]
  }'
```
**Respuesta (`201 Created`):**
```json
{
  "id_pedido": 88,
  "id_mesa": 2,
  "estado": "pendiente",
  "total": 54000.00,
  "fecha_creacion": "2026-11-12T20:15:30.000Z"
}
```

---

### 9.5 Facturar y Liquidar un Pedido
```bash
curl -X POST http://localhost:3000/api/v1/facturacion \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_pedido": 88,
    "metodo_pago": "efectivo",
    "monto_recibido": 60000.00,
    "incluye_propina": true,
    "porcentaje_propina": 10
  }'
```
**Respuesta (`201 Created`):**
```json
{
  "id_factura": 45,
  "id_pedido": 88,
  "subtotal": 54000.00,
  "propina": 5400.00,
  "total": 59400.00,
  "cambio": 600.00,
  "metodo_pago": "efectivo",
  "fecha_emision": "2026-11-12T21:05:12.000Z"
}
```

---

## 🧪 10. Pruebas y Aseguramiento de Calidad

```bash
# Backend - Pruebas Unitarias y de Integración con Jest
cd backend
npm test

# Backend - Cobertura de Código
npm run test:cov

# Frontend - Pruebas Unitarias con Vitest
cd frontend
npm test

# Análisis de Calidad y Deuda Técnica con SonarQube
cd ..
.\ejecutar_sonar_scan.bat
```

---

## 👥 11. Equipo de Desarrollo y Créditos

Proyecto desarrollado como parte de la asignatura **Programación II**, Universidad del Cauca (2026):
- **Equipo Trinity** — Ingeniería de Sistemas.
- **Cliente:** Luigie's Restaurante Nocturno (Popayán, Cauca).
- **Licencia:** MIT License.