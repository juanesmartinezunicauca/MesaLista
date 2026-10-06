# 🚀 Guía de Despliegue 100% Gratuito y Permanente: MesaLista

Esta arquitectura utiliza exclusivamente planes **Hobby / Free Tier permanentes** (sin suscripciones, sin pruebas que caduquen a los 30 días y sin cobros obligatorios):

| Componente | Plataforma | Capacidad Gratuita Permanente | Costo |
| :--- | :--- | :--- | :--- |
| **Base de Datos** | [Neon.tech](https://neon.tech) | PostgreSQL Serverless (0.5 GB almacenamiento, auto-suspensión, backups) | **$0 / mes** |
| **Backend API** | [Render.com](https://render.com) | 750 horas/mes de Web Service gratuito, HTTPS automático, auto-deploy GitHub | **$0 / mes** |
| **Frontend SPA** | [Vercel.com](https://vercel.com) | Despliegues estáticos ilimitados, CDN global rápida, HTTPS incluido | **$0 / mes** |
| **OAuth 2.0** | Google Cloud Console | Google Identity Services (GSI) | **$0 / mes** |

---

## 1. Configuración de Google OAuth 2.0 (Google Cloud Console)

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com).
2. Crea un proyecto nuevo o selecciona uno existente (ej: `MesaLista`).
3. Ve a **APIs y servicios** > **Pantalla de consentimiento de OAuth**:
   - Selecciona **Externo** y haz clic en **Crear**.
   - Completa el **Nombre de la aplicación** (ej: *MesaLista*), correo de soporte y datos de contacto.
   - Guarda los cambios.
4. Ve a **APIs y servicios** > **Credenciales**:
   - Haz clic en **+ Crear credenciales** > **ID de cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `MesaLista Web Client`.
   - **Orígenes autorizados de JavaScript**:
     - `http://localhost:4200` *(para desarrollo local)*
     - `https://tu-proyecto.vercel.app` *(tu dominio de Vercel una vez desplegado)*
   - Haz clic en **Crear**.
5. Copia el **ID de cliente** (formato: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

---

## 2. Base de Datos en Neon (PostgreSQL Serverless)

1. Crea tu cuenta gratuita en [Neon.tech](https://neon.tech) (inicia con GitHub o Google).
2. Haz clic en **Create Project**:
   - Nombre: `mesalista-db`
   - Versión de Postgres: 16 o 17 (Recomendado)
   - Región: Elige la más cercana a tu audiencia (ej. *US East (Ohio)*).
3. En el panel principal de Neon, copia la cadena de conexión (`Connection string`) en modo **Pooled** o **Direct**:
   ```env
   postgresql://tu_usuario:tu_password@ep-ejemplo.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **Inicializar la base de datos desde tu terminal local**:
   En la raíz del proyecto, en la carpeta `backend`:
   ```bash
   cd backend
   # Ejecuta el schema contra Neon pasando la URL temporalmente:
   DATABASE_URL="tu_url_de_neon_aqui" npx prisma db push

   # Inserta los datos semilla (usuario admin por defecto, roles, etc.):
   DATABASE_URL="tu_url_de_neon_aqui" npx prisma db seed
   ```

---

## 3. Despliegue del Backend en Render (100% Gratis)

1. Crea tu cuenta en [Render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **New +** > **Web Service**.
3. Conecta tu repositorio de GitHub: `juanesmartinezunicauca/MesaLista`.
4. Configura el servicio:
   - **Name**: `mesalista-backend`
   - **Region**: La misma de Neon (ej: *Ohio (US East)*)
   - **Branch**: `develop` o `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Instance Type**: **Free** ($0/month)
5. En la sección **Environment Variables**, añade:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = *(La URL copiada de Neon con `?sslmode=require`)*
   - `JWT_SECRET` = *(Una clave aleatoria segura de al menos 32 caracteres)*
   - `JWT_EXPIRES_IN` = `12h`
   - `CORS_ORIGIN` = `https://tu-proyecto.vercel.app`
   - `GOOGLE_CLIENT_ID` = *(Tu ID de cliente copiado de Google Cloud Console)*
6. Haz clic en **Deploy Web Service**.
7. Una vez desplegado, Render te otorgará una URL pública, por ejemplo:
   `https://mesalista-backend.onrender.com`

---

## 4. Despliegue del Frontend en Vercel (100% Gratis)

1. En el frontend, actualiza [environment.ts](file:///d:/UNICAUCA/Pro%20II/Mesa%20Lista/frontend/src/environments/environment.ts):
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://mesalista-backend.onrender.com/api/v1',
     appName: 'MesaLista',
     googleClientId: 'TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com'
   };
   ```
2. Crea tu cuenta en [Vercel.com](https://vercel.com) e inicia sesión con GitHub.
3. Haz clic en **Add New...** > **Project**.
4. Importa el repositorio `MesaLista`.
5. En la configuración del proyecto:
   - **Framework Preset**: `Angular`
   - **Root Directory**: Haz clic en *Edit* y selecciona `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend/browser` *(el archivo `vercel.json` ya fue creado para gestionar el enrutamiento SPA)*.
6. Haz clic en **Deploy**.
7. Vercel te entregará una URL como:
   `https://mesalista.vercel.app`

---

## 5. Paso Final de Sincronización

1. Vuelve a **Google Cloud Console** > **Credenciales** > Edita tu cliente OAuth y añade tu dominio final de Vercel (`https://mesalista.vercel.app`) en los **Orígenes autorizados de JavaScript**.
2. En **Render** > Variables de Entorno del backend, actualiza `CORS_ORIGIN` con tu dominio de Vercel.

¡Listo! Tu aplicación estará funcionando 24/7 en la nube, con autenticación OAuth 2.0 y base de datos PostgreSQL, sin ningún costo mensual.
