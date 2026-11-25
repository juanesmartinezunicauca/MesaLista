# 🚀 Guía de Despliegue 100% Gratuito y Permanente: MesaLista POS

Esta arquitectura utiliza exclusivamente planes **Hobby / Free Tier permanentes** (sin pruebas que caduquen a los 30 días ni cobros obligatorios):

| Componente | Plataforma | Capacidad Gratuita Permanente | Costo |
| :--- | :--- | :--- | :--- |
| **Base de Datos** | [Neon.tech](https://neon.tech) | PostgreSQL Serverless 16+ (0.5 GB almacenamiento, auto-suspensión, respaldos) | **\$0 / mes** |
| **Backend API** | [Render.com](https://render.com) | 750 horas/mes de Web Service gratuito, HTTPS automático, auto-deploy desde GitHub | **\$0 / mes** |
| **Frontend SPA** | [Vercel.com](https://vercel.com) | Despliegues estáticos ilimitados, CDN global, HTTPS y cabeceras de seguridad | **\$0 / mes** |
| **OAuth 2.0** | Google Cloud Console | Google Identity Services (GIS / OIDC) | **\$0 / mes** |
| **Correo Transaccional** | [Brevo](https://www.brevo.com) | Envío por REST API HTTPS (puerto 443, inmune al bloqueo SMTP de Render Free) | **\$0 / mes** |

---

## 1. Configuración de Google OAuth 2.0 (Google Cloud Console)

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com).
2. Crea un proyecto nuevo o selecciona uno existente (ej. `MesaLista`).
3. Ve a **APIs y servicios** > **Pantalla de consentimiento de OAuth**:
   - Selecciona **Externo** y haz clic en **Crear**.
   - Completa el **Nombre de la aplicación** (*MesaLista*), correo de soporte y datos de contacto, y guarda los cambios.
4. Ve a **APIs y servicios** > **Credenciales**:
   - Haz clic en **+ Crear credenciales** > **ID de cliente de OAuth** (tipo **Aplicación web**).
   - Nombre: `MesaLista Web Client`.
   - **Orígenes autorizados de JavaScript**:
     - `http://localhost:4200` *(desarrollo local)*
     - `https://mesa-lista-virid.vercel.app` *(o tu dominio final de Vercel)*
   - Haz clic en **Crear** y copia el **ID de cliente** (`xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

---

## 2. Base de Datos en Neon (PostgreSQL Serverless)

1. Crea tu cuenta gratuita en [Neon.tech](https://neon.tech) y haz clic en **Create Project**:
   - Nombre: `mesalista-db`
   - Versión de PostgreSQL: **16 o 17**
   - Región: cercana al Web Service de Render (ej. *US East (Ohio)*).
2. Copia la cadena de conexión (`Connection string`) con `?sslmode=require`:
   ```env
   postgresql://tu_usuario:tu_password@ep-ejemplo.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. **Inicializar esquema y datos semilla desde tu terminal local**:
   ```bash
   cd backend
   DATABASE_URL="tu_url_de_neon_aqui" npx prisma db push
   DATABASE_URL="tu_url_de_neon_aqui" npx prisma db seed
   ```

---

## 3. Despliegue del Backend en Render

1. Inicia sesión en [Render.com](https://render.com) con GitHub y selecciona **New +** > **Web Service**.
2. Conecta tu repositorio `MesaLista` y configura:
   - **Name**: `mesalista-backend`
   - **Region**: la misma que Neon (ej. *Ohio - US East*)
   - **Branch**: `main` (o la rama de despliegue acordada)
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Instance Type**: **Free** (\$0/mes)
3. Configura las **Environment Variables** (validadas al arranque por Joi en `AppModule`):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = *(URL de Neon con `?sslmode=require`)*
   - `JWT_SECRET` = *(clave aleatoria segura de al menos 32 caracteres)*
   - `JWT_EXPIRES_IN` = `12h`
   - `CORS_ORIGIN` = `https://mesa-lista-virid.vercel.app` *(orígenes exactos permitidos, separados por coma)*
   - `FRONTEND_URL` = `https://mesa-lista-virid.vercel.app` *(usado para generar enlaces directos de activación y validar CORS estricto)*
   - `GOOGLE_CLIENT_ID` = *(Client ID de Google Cloud Console)*
   - `BREVO_API_KEY` = *(API Key REST v3 de Brevo para envío de códigos `INV-XXXXXXXX`)*
   - `BREVO_SENDER_EMAIL` = *(correo remitente verificado en Brevo)*
4. Haz clic en **Deploy Web Service**. Render expondrá la API en `https://mesalista-p0pf.onrender.com` (o el subdominio asignado).

> **Nota sobre seguridad en Render:** El backend tiene configurado `trust proxy = 1` para que `@nestjs/throttler` aplique los límites de tasa sobre la IP real del cliente detrás del proxy de Render, y valida CORS por `hostname` exacto rechazando dominios `*.vercel.app` de terceros que no coincidan con `CORS_ORIGIN` / `FRONTEND_URL`.

---

## 4. Despliegue del Frontend en Vercel

1. Verifica que [`frontend/src/environments/environment.ts`](./frontend/src/environments/environment.ts) apunte a tu backend en Render y al mismo `GOOGLE_CLIENT_ID`:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://mesalista-p0pf.onrender.com/api/v1',
     appName: 'MesaLista',
     googleClientId: 'TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com',
   };
   ```
2. En [Vercel.com](https://vercel.com), selecciona **Add New...** > **Project** e importa el repositorio `MesaLista`.
3. Configura el proyecto:
   - **Framework Preset**: `Angular`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend` *(coincide con [`frontend/vercel.json`](./frontend/vercel.json) y [`frontend/angular.json`](./frontend/angular.json))*
4. El archivo [`frontend/vercel.json`](./frontend/vercel.json) ya incluye tanto las reglas de enrutamiento SPA (`rewrites` hacia `/index.html`) como las cabeceras HTTP defensivas (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`).
5. Haz clic en **Deploy**.

---

## 5. Paso Final de Sincronización y Verificación

1. En **Google Cloud Console** > **Credenciales**, confirma que el dominio final de Vercel figure en **Orígenes autorizados de JavaScript**.
2. En **Render**, confirma que `CORS_ORIGIN` y `FRONTEND_URL` contengan exactamente el dominio final de Vercel (sin barra final `/`).
3. Ejecuta una verificación rápida en producción:
   - Abrir `/cliente` y validar carga de catálogo público (sin exposición de campo `costo`).
   - Iniciar sesión con Google en `/login` como administrador y validar acceso a `/dashboard`, `/caja` y `/reportes`.
   - Crear un colaborador de prueba con correo de envío y confirmar recepción del código `INV-XXXXXXXX` vía Brevo.
