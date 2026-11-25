# MesaLista POS 🍽️ — Sistema Integral de Gestión Restaurantera y Punto de Venta

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-ea2845?style=flat&logo=nestjs)](https://nestjs.com/)
[![Angular](https://img.shields.io/badge/Frontend-Angular%2022-dd0031?style=flat&logo=angular)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![OpenAPI](https://img.shields.io/badge/Docs-OpenAPI%203.0%20%2F%20Swagger-85ea2d?style=flat&logo=swagger)](http://localhost:3000/api/docs)
[![Arc42](https://img.shields.io/badge/Architecture-Arc42%20v8.2-blue)](docs/arquitectura/arc42.md)
[![IEEE](https://img.shields.io/badge/Standard-IEEE%201063%20%7C%20ISO%2026514-informational)](docs/manual-tecnico-usuario.md)
[![Security](https://img.shields.io/badge/Security-OWASP%20Top%2010%20(2025)-brightgreen)](OWASP_COMPLIANCE.md)

---

## 📌 1. Visión General del Sistema

**MesaLista POS** es una solución integral de Punto de Venta, Comandería y Gestión Operativa diseñada para locales gastronómicos de alta rotación, implementada y validada con el **Restaurante Nocturno Luigie's** (Popayán, Cauca, Colombia).

El sistema centraliza y sincroniza en tiempo real las operaciones clave del restaurante:
- **Gestión de Salón y Mesas:** Plano interactivo visual, control de estados (`libre`, `ocupada`), transferencia transaccional de cuentas entre mesas y comandería rápida por mesero.
- **Cocina (KDS - Kitchen Display System):** Cola visual de comandas en tiempo real con tiempos de preparación, observaciones personalizadas por plato e ingredientes removibles.
- **Domicilios y Portal Cliente:** Carta digital pública (`/cliente`), carrito de compras (`/cliente/carrito`) accesible para clientes y también para colaboradores que deseen hacer pedidos personales, control de disponibilidad del servicio y seguimiento por etapas (`Pendiente` → `En Preparación` → `En Reparto` → `Entregado`).
- **Arqueo y Control de Turnos de Caja:** Apertura con fondo base inicial, registro de gastos menores por categoría y medio de pago, arqueo físico ciego y cierre con cálculo exacto de sobrante/faltante y protección contra concurrencia.
- **Facturación y Liquidación:** Pagos simples o mixtos (efectivo, datáfono/tarjeta, transferencia/QR), propina voluntaria, anulación auditada con restitución de estado de mesa, consecutivo atómico y soporte para impresión térmica ESC/POS.
- **Reportes y Analítica (BI):** Dashboard consolidado, ventas por canal/categoría, conciliación de caja y medios de pago, inventario valorizado, egresos, rentabilidad bruta y operación en cocina con filtros por rango de fechas y exportación CSV/Excel/PDF.
- **Autenticación Federada de Alta Seguridad:** Acceso mediante **Google OAuth 2.0 (Google Identity Services)** sin contraseñas locales, enrolamiento de colaboradores mediante códigos criptográficos efímeros (`INV-XXXXXXXX`, vigencia 48 h) sin persistir correos personales de empleados en base de datos, y control de acceso basado en roles (**RBAC**).

---

## 📚 2. Estándares y Documentación Técnica del Repositorio

El proyecto sigue estándares internacionales de arquitectura, documentación de usuario, especificación de APIs y aseguramiento de calidad/seguridad:

| Documento | Estándar / Marco | Descripción |
|---|---|---|
| [**Swagger UI Interactivo**](http://localhost:3000/api/docs) | **OpenAPI Specification 3.0** | Catálogo vivo de endpoints bajo `/api/v1`, esquemas DTO, ejemplos y autenticación Bearer interactiva en `/api/docs`. |
| [**Arc42 Architectural Blueprint**](docs/arquitectura/arc42.md) | **Arc42 v8.2 / ISO 42010** | Especificación integral de arquitectura: contexto, bloques C4, vista de ejecución, despliegue, ADRs y escenarios de calidad. |
| [**Manual Técnico y de Usuario**](docs/manual-tecnico-usuario.md) | **IEEE 1063 & ISO/IEC/IEEE 26514** | Guía de instalación, diccionario relacional de BD, manual operativo por rol y guía de solución de fallos. |
| [**Documento de Entrega y Acuerdos Finales**](docs/entrega-final-y-acuerdos.md) | **Cierre de Proyecto** | Inventario de entregables, resumen de pruebas, limitaciones acordadas, transferencia operativa y acta de aceptación. |
| [**Matriz de Cumplimiento OWASP**](OWASP_COMPLIANCE.md) | **OWASP Top 10 (2025)** | Auditoría de mitigaciones A01–A10, evidencia de pruebas automatizadas y reporte HTML interactivo. |
| [**Informe Técnico de Pruebas Fuzzy**](INFORME_TECNICO_FUZZY.md) | **Fuzzing & Resiliencia** | Análisis de límites del motor PostgreSQL/Prisma, concurrencia, `fast-check` y reporte HTML de fuzzing. |
| [**Informe DAST OWASP ZAP + CVSS v3.1**](reports/INFORME_CVSS_OWASP_ZAP.md) | **OWASP ZAP / CVSS v3.1** | Evaluación dinámica de seguridad contra despliegue en producción y catálogo de hallazgos. |
| [**Guía de Despliegue Cloud**](GUIA_DESPLIEGUE.md) | **Neon + Render + Vercel** | Procedimiento paso a paso para despliegue gratuito permanente con Google OAuth 2.0 y Brevo. |

---

## 🛠️ 3. Stack Tecnológico

```mermaid
flowchart LR
    subgraph Client["Frontend (SPA)"]
        A[Angular 22 Standalone] --> B[Signals & RxJS 7]
        B --> C[Angular Material & SCSS]
        C --> D[Google Identity Services GIS]
    end

    subgraph Server["Backend API"]
        E[NestJS 12 REST] --> F[Prisma ORM 6]
        E --> G[Passport JWT & Class-Validator]
        E --> H[Helmet, Throttler & Swagger 3.0]
        E --> I[Brevo REST API / SMTP Mailer]
    end

    subgraph Data["Infraestructura & Datos"]
        J[(PostgreSQL 16 Neon / Local)]
        K[Docker & Docker Compose]
        L[Impresoras ESC/POS TCP/USB]
    end

    Client -->|HTTPS / JSON + Bearer JWT| Server
    Server -->|Pool TCP / TLS| Data
```

- **Frontend:** Angular 22, TypeScript 6.0, RxJS 7.8, Standalone Components, Angular Signals, Angular Material 22, Reactive Forms, SCSS modular, exportación `xlsx`/`jspdf`, pruebas con **Vitest 4**.
- **Backend:** NestJS 12, Node.js 20/24 LTS, TypeScript 6.0, Passport JWT, `class-validator`, Helmet, `@nestjs/throttler`, `oxlint`, pruebas con **Jest 30** y **fast-check**.
- **Persistencia:** Prisma ORM 6.19, PostgreSQL 16 (Neon Serverless en nube o PostgreSQL local).
- **Seguridad y Correo:** Google Identity Services (`google-auth-library`), JWT Bearer, Brevo REST API v3 (HTTPS 443) con respaldo Resend/SMTP endurecido.
- **Hardware Integrado:** Impresión de recibos térmicos de 80 mm / 58 mm vía ESC/POS (`node-thermal-printer`).

---

## 📋 4. Requisitos Previos

Antes de ejecutar el proyecto en local, asegúrate de contar con:
- **Node.js:** v20.x o v24.x LTS ([Descargar](https://nodejs.org/))
- **npm:** v10+
- **PostgreSQL:** v15/v16 local **o** conexión a PostgreSQL en la nube ([Neon.tech](https://neon.tech)).
- **Docker & Docker Compose** *(Opcional, para despliegue en contenedores)*.
- **Google Cloud Console:** OAuth 2.0 Web Client ID con `http://localhost:4200` en orígenes JavaScript autorizados.

---

## ⚙️ 5. Configuración de Variables de Entorno

### 5.1 Backend (`backend/.env`)
Copia la plantilla [`backend/.env.example`](backend/.env.example) como `backend/.env` (este archivo está ignorado en `.gitignore` y **nunca** se versiona):

```bash
# Windows PowerShell:
Copy-Item backend/.env.example backend/.env

# Linux / macOS:
cp backend/.env.example backend/.env
```

Variables principales:

```ini
# Servidor HTTP
PORT=3000
NODE_ENV=development

# Base de datos PostgreSQL (Local o Neon Cloud)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mesalista?schema=public"

# Seguridad JWT (mínimo 32 caracteres de alta entropía)
JWT_SECRET="CAMBIE_ESTO_POR_UN_SECRETO_SEGURO_DE_AL_MENOS_32_CHARS"
JWT_EXPIRES_IN="12h"

# CORS (orígenes autorizados separados por coma) y URL pública del frontend
CORS_ORIGIN="http://localhost:4200,https://mesa-lista-virid.vercel.app"
FRONTEND_URL="https://mesa-lista-virid.vercel.app"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="123456789012-ejemplo.apps.googleusercontent.com"

# Correo transaccional (Brevo REST API v3 — puerto 443 HTTPS)
BREVO_API_KEY="xkeysib-tu-api-key-de-brevo"
BREVO_SENDER_EMAIL="notificaciones@tudominio.com"

# Impresora térmica ESC/POS (opcional)
PRINTER_INTERFACE="tcp://192.168.1.200:9100"
```

### 5.2 Frontend (`frontend/src/environments/`)
Configura el entorno local en [`frontend/src/environments/environment.development.ts`](frontend/src/environments/environment.development.ts) (y producción en [`frontend/src/environments/environment.ts`](frontend/src/environments/environment.ts)):

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  appName: 'MesaLista',
  googleClientId: '123456789012-ejemplo.apps.googleusercontent.com',
};
```

---

## 🚀 6. Guía de Instalación y Ejecución Local

### Paso 1: Backend y Base de Datos
```bash
cd backend
npm install

# Generar el cliente tipado de Prisma
npx prisma generate

# Sincronizar el modelo relacional en PostgreSQL
npx prisma db push

# Poblar datos iniciales (mesas, medios de pago, tipos de gasto y administrador inicial)
npx prisma db seed

# Iniciar servidor en desarrollo con recarga en vivo
npm run start:dev
```
> Backend activo en: `http://localhost:3000/api/v1`  
> Documentación interactiva Swagger: `http://localhost:3000/api/docs`

### Paso 2: Frontend SPA (Angular 22)
En una segunda terminal:
```bash
cd frontend
npm install

# Iniciar la aplicación Angular
npm start
```
> Interfaz web disponible en: `http://localhost:4200` (el portal público de clientes está en `/cliente` y el acceso operativo en `/login`).

---

## 🐳 7. Ejecución con Docker Compose (Todo en Uno)

```bash
# Construir e iniciar PostgreSQL, Backend NestJS y Frontend Nginx
docker compose up --build -d

# Ver logs en tiempo real
docker compose logs -f

# Detener los contenedores
docker compose down
```

Puertos expuestos:
- **Frontend Web:** `http://localhost:80`
- **Backend API & Swagger:** `http://localhost:3000/api/v1` y `http://localhost:3000/api/docs`
- **PostgreSQL:** `localhost:5432`

---

## 🔐 8. Roles de Usuario y Flujo de Autenticación

El sistema utiliza autenticación federada **Google OAuth 2.0 (OIDC)** sin contraseñas locales y privacidad por diseño para empleados:

```mermaid
flowchart TD
    A[Usuario pulsa 'Continuar con Google'] --> B[Google Identity Services GIS]
    B -->|ID Token JWT firmado| C[Frontend envía idToken a POST /api/v1/auth/google]
    C --> D[Backend verifica firma criptográfica con google-auth-library]
    D --> E{¿Incluye codigoInvitacion INV-XXXXXXXX?}
    E -->|Sí| F[Valida código vigente 48h y cuenta activa]
    F --> G[Quema código atómicamente con updateMany y enlaza googleId sin guardar email]
    E -->|No| H{¿Existe usuario por googleId?}
    H -->|Sí y activo| I[Emite JWT con id_usuario y rol operativo o cliente]
    H -->|Sí pero inactivo| J[401 Unauthorized: Cuenta inactiva]
    H -->|No| K[Crea cuenta rol 'cliente' con googleId y email para domicilios]
    G --> I
    K --> I
    I --> L[Frontend guarda JWT y redirige según rol]
```

### Roles del Sistema (`RolUsuario` en Prisma / RBAC)
- **`administrador`:** Control total del sistema (gestión de colaboradores e invitaciones, catálogo, ajustes de inventario, mesas, caja, anulaciones, auditoría y módulo BI de reportes).
- **`cajero`:** Apertura y cierre ciego de caja, registro de gastos menores, facturación/cobros, anulación auditada, gestión de mesas, comandas y domicilios.
- **`mesero`:** Plano de mesas, toma y edición de comandas, transferencia de cuentas entre mesas, consulta de carta y cobro de pedidos.
- **`cocina`:** Pantalla KDS de cocina para visualizar y gestionar el estado de preparación de comandas.
- **`cliente`:** Acceso al portal público `/cliente`, carrito `/cliente/carrito`, creación de pedidos a domicilio y consulta exclusiva de sus propios pedidos (protección anti-IDOR).
- **Colaboradores como clientes:** Cualquier empleado autenticado (`administrador`, `cajero`, `mesero`, `cocina`) puede acceder también a `/cliente` y hacer pedidos personales a domicilio (etiquetados internamente con `[PORTAL_CLIENTE]` para no mezclarlos con domicilios tomados en el POS). Desde `/login`, hacer clic en el logo de MesaLista redirige directamente a `/cliente`.

---

## 📡 9. Ejemplos de Uso de la API (`cURL`)

Todos los endpoints protegidos requieren la cabecera `Authorization: Bearer <TOKEN_JWT>`.

### 9.1 Autenticación con Google OAuth 2.0 (con o sin código de invitación)
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEy...",
    "codigoInvitacion": "INV-A7B9C3D5"
  }'
```
**Respuesta (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id_usuario": 2,
    "nombre": "Carlos Mesero",
    "usuario": "cmesero",
    "email": null,
    "rol": "mesero",
    "estado": "activo"
  }
}
```

### 9.2 Consultar Estado Operativo de Caja
```bash
curl -X GET http://localhost:3000/api/v1/caja/estado \
  -H "Authorization: Bearer $TOKEN"
```

### 9.3 Listar Mesas del Salón
```bash
curl -X GET http://localhost:3000/api/v1/mesas \
  -H "Authorization: Bearer $TOKEN"
```

### 9.4 Crear una Comanda de Salón
```bash
curl -X POST http://localhost:3000/api/v1/pedidos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_mesa": 2,
    "tipo": "salon",
    "observacion": "Sin cebolla en la hamburguesa especial",
    "items": [
      {
        "id_producto": 5,
        "cantidad": 2,
        "observacion": "Término medio"
      }
    ]
  }'
```

### 9.5 Emitir Factura y Registrar Pagos en Caja
```bash
curl -X POST http://localhost:3000/api/v1/facturas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_pedido": 88,
    "propina": 5400,
    "pagos": [
      {
        "medio_pago": "Efectivo",
        "monto": 60000
      }
    ]
  }'
```

---

## 🧪 10. Pruebas y Aseguramiento de Calidad

```bash
# Backend — Linting ultrarrápido con oxlint
npm --prefix backend run lint

# Backend — Batería completa (Unitarias, Integración, OWASP y Fuzzing con Jest 30)
npm --prefix backend run test

# Backend — Cobertura de código
npm --prefix backend run test:cov

# Backend — Reporte HTML dedicado de cumplimiento OWASP Top 10
npm --prefix backend run test:owasp

# Backend — Reporte HTML dedicado de pruebas Fuzzy / fast-check
npm --prefix backend run test:fuzz

# Frontend — Pruebas unitarias con Vitest 4
npm --prefix frontend run test -- --watch=false

# Rendimiento (Artillery / Lighthouse) y Calidad (SonarQube)
npm run perf:backend
npm run perf:frontend
.\ejecutar_sonar_scan.bat
```

---

## 👥 11. Equipo de Desarrollo y Créditos

Proyecto desarrollado en la asignatura **Programación II**, Universidad del Cauca (2026):
- **Autores (Equipo Trinity):** Juan Esteban Martínez y Daniel Piedrahita — Ingeniería de Sistemas.
- **Docente:** Siler Amador.
- **Cliente Piloto:** Luigie's Restaurante Nocturno — Luis Miguel (Popayán, Cauca).
- **Licencia:** MIT License.
