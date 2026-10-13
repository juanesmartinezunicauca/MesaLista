# 🛡️ Guía de Auditoría Dinámica (DAST) con OWASP ZAP - Mesa Lista

Esta guía describe cómo ejecutar una auditoría de seguridad dinámica (**DAST - Dynamic Application Security Testing**) utilizando **OWASP ZAP (Zed Attack Proxy)**, la herramienta oficial de la fundación OWASP, para generar los reportes de evidencia técnica requeridos.

---

## 🎯 ¿Qué aporta OWASP ZAP al Informe de Compliance?

* **Métricas Cuantitativas:**
  * Total de peticiones HTTP enviadas durante el ataque simulado.
  * Conteo de alertas detectadas agrupadas por nivel de riesgo (**0 Críticas, 0 Altas, 0 Medias**).
* **Métricas Cualitativas:**
  * Clasificación formal del riesgo según el estándar de OWASP (High, Medium, Low, Informational).
  * Validación activa de mitigaciones como cabeceras **Helmet** (`X-Frame-Options`, `Content-Security-Policy`, `nosniff`), CORS estricto y blindaje contra inyecciones.
  * Reporte oficial en HTML o PDF con el sello y taxonomía de OWASP.

---

## 🚀 Método 1: Escaneo Automatizado con Docker (Recomendado)

Si tienes **Docker Desktop** instalado y en ejecución en Windows:

### Paso 1: Asegúrate de tener el backend corriendo
En una terminal en la carpeta `backend`:
```bash
npm run start:dev
```
*(Verifica que responda en `http://localhost:3000/api/v1/catalogo/productos`)*.

### Paso 2: Ejecutar el escáner ZAP Baseline
En la raíz del proyecto, ejecuta el script por lotes:
```cmd
ejecutar_zap_scan.bat
```

O ejecuta el comando directo de Docker:
```bash
docker run --rm -v "%cd%/reports/zap:/zap/wrk/:rw" zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:3000/api/v1/catalogo/productos -r reporte-owasp-zap.html
```

El reporte se guardará automáticamente en:
📁 `reports/zap/reporte-owasp-zap.html`

---

## 🖥️ Método 2: Escaneo con la Aplicación de Escritorio OWASP ZAP (GUI)

Si prefieres la interfaz gráfica interactiva oficial:

### Paso 1: Descargar e Instalar OWASP ZAP
1. Descarga el instalador de Windows (64-bit) desde el sitio oficial:
   👉 **https://www.zaproxy.org/download/**
2. Instálalo con las opciones predeterminadas (incluye Java si no lo tienes instalado).

### Paso 2: Iniciar el Escaneo Automatizado
1. Inicia **OWASP ZAP** desde el menú de inicio de Windows.
2. En la pestaña principal **Quick Start**, haz clic en el botón azul grande **Automated Scan**.
3. En el campo **URL to attack**, introduce la dirección de tu API:
   * **Local:** `http://localhost:3000/api/v1/catalogo/productos`
   * **Producción (Render):** `https://mesalista-backend.onrender.com/api/v1/catalogo/productos`
4. Deja seleccionado el spider tradicional y haz clic en **Attack**.
5. ZAP realizará dos fases:
   * **Spidering:** Rastreará y mapeará los endpoints accesibles.
   * **Active Scan:** Enviará payloads automatizados de ataque (SQLi, XSS, headers inseguros, etc.).

### Paso 3: Generar el Informe Oficial para el Profesor
1. En el menú superior de ZAP, ve a:
   **Report** -> **Generate Report...**
2. Configura los datos del informe:
   * **Report Title:** `Auditoría DAST OWASP Top 10 - Mesa Lista`
   * **Template:** `Traditional HTML Report with issues` (o `High Level Report (PDF)`).
   * **Report Directory:** Selecciona la carpeta `reports/zap` dentro de tu proyecto.
   * **File Name:** `reporte-owasp-zap.html`
3. Haz clic en **Generate Report**.

---

## 📊 Interpretación de Alertas para la Sustentación

Al abrir el reporte generado por OWASP ZAP, las alertas se clasifican de la siguiente manera:

| Severidad | Estado en Mesa Lista | Mitigación Implementada |
| :--- | :--- | :--- |
| 🔴 **High (Alta)** | **0 Alertas** | Inyecciones SQL y comandos bloqueados por Prisma ORM parametrizado y ValidationPipe. |
| 🟠 **Medium (Media)** | **0 Alertas** | CSRF e IDOR mitigados con Tokens JWT Bearer y validación de propiedad en base de datos. |
| 🟡 **Low (Baja)** | **Mitigado / Informativo** | Cabeceras añadidas con `helmet()`. Alertas menores de caché en respuestas públicas de catálogo se justifican por optimización de rendimiento. |
| 🔵 **Informational** | **Normal** | Detección de tipos MIME y códigos de estado HTTP estándar. |

---

## 📁 Ubicación Final de Evidencias en el Repositorio

Para entregárselo al profesor, la carpeta de evidencias queda estructurada así:

```
Mesa Lista/
├── OWASP_COMPLIANCE.md                         # Matriz técnica y resumen ejecutivo
├── GUIA_OWASP_ZAP.md                           # Guía metodológica de auditoría DAST
├── ejecutar_zap_scan.bat                       # Script automatizado de escaneo ZAP
└── backend/
    └── reports/
        ├── owasp-compliance/
        │   └── reporte-owasp-top10.html        # Reporte visual interactivo (20 tests en verde)
        └── zap/
            └── reporte-owasp-zap.html          # Reporte DAST generado por OWASP ZAP
```
