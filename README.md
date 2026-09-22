# MesaLista

Sistema POS y de gestión operativa para restaurantes y locales gastronómicos: control de mesas, pedidos, comandas a cocina, caja e inventario.

## Visión General
- **Cliente Piloto:** Restaurante nocturno Luigie's (Popayán, Cauca, Colombia)
- **Equipo de Desarrollo:** Trinity (Universidad del Cauca, 2026)
- **Enfoque Arquitectónico:** Local-First / Offline-First en red de área local (LAN).

## Estructura del Proyecto (Monorepo)
```text
MesaLista/
├── docker-compose.yml          # Orquestación con Docker (PostgreSQL, Backend, Frontend)
├── configurar_postgres.bat     # Script de configuración rápida de PostgreSQL local (Windows)
├── README.md                   # Documentación general y guía de ejecución
├── backend/                    # API REST con NestJS 12, Prisma ORM, PostgreSQL
└── frontend/                   # SPA con Angular 22, Material/SCSS, Standalone Components
```

## Requisitos Previos
Antes de comenzar, asegúrate de contar con:
- **Node.js**: v18.x o superior (recomendado v20+ LTS)
- **npm**: v9.x o superior
- **PostgreSQL**: v16+ (ejecutándose en el puerto estándar `5432`) **O** **Docker / Docker Desktop**
- **Git**

---

## 🚀 Guía de Ejecución en Desarrollo Local

> [!NOTE]
> Si abriste la terminal desde la carpeta contenedora superior (`MESALISTA_V1.0`), ingresa primero a la carpeta del proyecto:
> ```bash
> cd MesaLista
> ```

Para trabajar en desarrollo local se requieren dos terminales abiertas simultáneamente (una para el Backend y otra para el Frontend), además de tener la base de datos activa.

### Paso 1: Base de Datos PostgreSQL

Puedes preparar la base de datos de dos formas:

#### Opción A: PostgreSQL local instalado en Windows
Si tienes PostgreSQL instalado en tu equipo, puedes ejecutar el script automatizado (haciendo clic derecho y seleccionando "Ejecutar como administrador" o desde la consola):
```cmd
.\configurar_postgres.bat
```
*Este script inicia el servicio de PostgreSQL, asegura el usuario `postgres` con contraseña `postgres` y crea la base de datos `mesalista`.*

#### Opción B: PostgreSQL mediante Docker
Si tienes Docker y no deseas instalar PostgreSQL directamente en Windows:
```bash
docker compose up postgres -d
```

---

### Paso 2: Ejecución del Backend (NestJS)

En tu **primera terminal**:

1. **Entrar a la carpeta del backend:**
   ```bash
   cd backend
   ```
   *(O desde la raíz de `MesaLista`: `cd MesaLista/backend` si te encuentras afuera)*

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar el archivo de entorno (`.env`):**
   Copia el archivo `.env.example` para generar tu `.env`:
   - En **PowerShell**:
     ```powershell
     Copy-Item .env.example .env
     ```
   - En **CMD (Símbolo del sistema)**:
     ```cmd
     copy .env.example .env
     ```
   - En **Bash / Linux / Git Bash**:
     ```bash
     cp .env.example .env
     ```
   *(Verifica que `DATABASE_URL` apunte a tu PostgreSQL local y que `JWT_SECRET` esté definido).*

4. **Sincronizar la base de datos y cargar datos iniciales (Seed):**
   ```bash
   # Genera el cliente tipado de Prisma
   npx prisma generate

   # Aplica el esquema Prisma sobre la base de datos
   npx prisma db push

   # Ejecuta el seed (crea usuario administrador inicial y las 6 mesas)
   npx prisma db seed
   ```

5. **Iniciar el servidor backend en modo desarrollo:**
   ```bash
   npm run start:dev
   ```
   - El backend iniciará en: `http://localhost:3000`
   - Prefijo de la API REST: `http://localhost:3000/api/v1`

---

### Paso 3: Ejecución del Frontend (Angular)

En tu **segunda terminal**:

1. **Entrar a la carpeta del frontend:**
   ```bash
   cd frontend
   ```
   *(O desde la raíz de `MesaLista`: `cd MesaLista/frontend`)*

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo de Angular:**
   ```bash
   npm start
   # o también:
   npm run dev
   ```
   - El frontend estará disponible en: `http://localhost:4200`
   - La aplicación se recarga automáticamente al guardar cambios en el código.

---

## ⚡ Comandos Rápidos desde la Raíz (`MesaLista/`)

Si no deseas navegar con `cd` en cada terminal, puedes correr los proyectos directamente desde la raíz `MesaLista/` usando el parámetro `--prefix`:

```bash
# Terminal 1 - Backend:
npm --prefix backend run start:dev

# Terminal 2 - Frontend:
npm --prefix frontend start
```

*(Si tu terminal se encuentra en la carpeta padre `MESALISTA_V1.0`, añade la ruta: `npm --prefix MesaLista/backend run start:dev` y `npm --prefix MesaLista/frontend start`).*

---

## 🐳 Opción con Docker Compose (Todo en uno)

Si prefieres correr toda la solución contenedorizada (Base de datos, Backend y Frontend):

1. Asegúrate de definir la variable `JWT_SECRET` (por ejemplo copiando el `.env.example` a `backend/.env`).
2. Desde la carpeta `MesaLista/`, ejecuta:
   ```bash
   docker compose up --build
   ```
3. Puertos asignados:
   - **Frontend:** `http://localhost:80`
   - **Backend API:** `http://localhost:3000/api/v1`
   - **PostgreSQL:** Puerto 5432 interno en la red Docker.

Para detener todos los servicios:
```bash
docker compose down
```

---

## 🔑 Credenciales de Acceso por Defecto

Tras ejecutar el seed (`npx prisma db seed`), puedes ingresar a la plataforma con las siguientes credenciales:

| Campo | Valor |
|---|---|
| **URL Frontend** | `http://localhost:4200` |
| **Usuario** | `admin` |
| **Contraseña** | `admin123` |
| **Rol** | `administrador` |

> [!TIP]
> El seed deja registradas 6 mesas (1 a 6) en estado libre listas para operar comandas.

---

## 🧪 Pruebas Unitarias

- **Backend (Jest):**
  ```bash
  cd backend
  npm test
  ```
- **Frontend (Vitest):**
  ```bash
  cd frontend
  npm test
  ```

