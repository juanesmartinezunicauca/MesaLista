# 📊 Guía Completa de Configuración y Análisis con SonarQube - MesaLista

Esta guía explica detalladamente cómo configurar, ejecutar e interpretar el análisis estático de código (**SAST - Static Application Security Testing**) y métricas de calidad de software con **SonarQube** en el proyecto **MesaLista POS & ERP**.

---

## 🎯 ¿Qué Evalúa SonarQube en el Proyecto?

SonarQube analiza exhaustivamente la salud técnica del monorepo (`backend/` y `frontend/`) bajo los siguientes ejes:

| Dimensión | Descripción | Objetivo en MesaLista |
|---|---|---|
| **Quality Gate** | Criterio global de aprobación (Aprobado / Reprobado) | **Passed (Aprobado)** |
| **Bugs** | Errores de lógica o sintaxis que provocan fallos en ejecución | **0 Bugs** |
| **Vulnerabilities** | Fallos de seguridad que comprometen el sistema (CWE / OWASP) | **0 Vulnerabilidades** |
| **Security Hotspots** | Puntos críticos que requieren revisión manual de seguridad | **100% Auditados** |
| **Code Smells** | Malas prácticas de diseño o código difícil de mantener | **Bajo (Deuda técnica < 5%)** |
| **Coverage** | Porcentaje de código cubierto por pruebas unitarias (LCOV) | **> 80% en lógica de negocio** |
| **Duplications** | Bloques de código redundantes o duplicados | **< 3%** |

---

## 🛠️ Estructura de Configuración del Proyecto

El proyecto incluye el archivo maestro de configuración en la raíz:
📂 [`sonar-project.properties`](./sonar-project.properties)

```properties
# Metadatos del Proyecto
sonar.projectKey=mesalista-pos
sonar.projectName=MesaLista POS & ERP
sonar.projectVersion=1.0.0
sonar.sourceEncoding=UTF-8

# Código Fuente y Pruebas Unitarias
sonar.sources=backend/src,frontend/src/app
sonar.tests=backend/src,backend/test,frontend/src/app
sonar.test.inclusions=**/*.spec.ts,backend/test/**/*.ts

# Exclusiones de Análisis
sonar.exclusions=**/node_modules/**,**/dist/**,**/reports/**,**/coverage/**,backend/prisma/**,**/*.html,**/*.scss

# Rutas de Cobertura de Pruebas (LCOV)
sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info

# Configuración TypeScript
sonar.typescript.tsconfigPaths=backend/tsconfig.json,frontend/tsconfig.json
```

---

## 🚀 Método 1: Ejecución Local con Docker (Recomendado para Entregas)

Este método es el más rápido y confiable para trabajar en tu computadora local sin necesidad de instalar Java ni configurar variables de entorno de Windows.

### Paso 1: Iniciar el Servidor SonarQube
1. Abre **Docker Desktop** en Windows.
2. En la raíz del proyecto, ejecuta haciendo doble clic o desde la consola:
   ```cmd
   iniciar_sonarqube.bat
   ```
   *(Este script descarga la imagen oficial `sonarqube:lts-community` y levanta el servidor en el puerto `9000`)*.
3. Espera unos 30-60 segundos a que el servidor inicialice por completo.
4. Ingresa en tu navegador a:
   👉 **http://localhost:9000**
5. Inicia sesión con las credenciales por defecto:
   - **Usuario:** `admin`
   - **Contraseña:** `admin`
   *(El sistema te solicitará cambiar la contraseña en el primer inicio. Por ejemplo: `Admin123*`)*.

---

### Paso 2: Generar tu Token de Análisis
1. En la consola web de SonarQube, haz clic en el ícono de tu perfil (esquina superior derecha).
2. Selecciona **My Account** (Mi Cuenta) y entra en la pestaña **Security**.
3. En la sección **Generate Tokens**:
   - Nombre: `mesalista-local`
   - Tipo: `User Token`
   - Expiración: `30 days` (o lo que prefieras)
   - Haz clic en **Generate**.
4. **Copia el token generado** (ejemplo: `sqp_3a1b2c3d4e5f6...`).

---

### Paso 3: Ejecutar el Análisis Automatizado
En la raíz del proyecto, ejecuta el script por lotes:
```cmd
ejecutar_sonar_scan.bat
```

1. El script te solicitará pegar el Token que copiaste en el Paso 2.
2. Automáticamente:
   - Ejecutará `npm run test:cov` en el backend para generar el reporte de cobertura `lcov.info`.
   - Ejecutará el contenedor `sonarsource/sonar-scanner-cli` analizando backend y frontend contra las reglas de SonarQube.
3. Al finalizar, ingresa a ver los resultados:
   👉 **http://localhost:9000/dashboard?id=mesalista-pos**

---

## ☁️ Método 2: Integración con SonarCloud (Nube / GitHub)

Si deseas que el análisis se ejecute en la nube y sea visible públicamente para tu profesor en GitHub:

1. Ingresa a **[SonarCloud.io](https://sonarcloud.io/)** e inicia sesión con tu cuenta de GitHub.
2. Importa la organización y selecciona el repositorio `MesaLista`.
3. SonarCloud te generará:
   - Una clave de organización (`sonar.organization`).
   - Un token secreto (`SONAR_TOKEN`).
4. En tu repositorio de GitHub:
   - Ve a **Settings -> Secrets and variables -> Actions**.
   - Agrega un nuevo secret: `SONAR_TOKEN` con el valor del token de SonarCloud.

5. Crea el flujo de trabajo en `.github/workflows/sonar.yml`:
```yaml
name: SonarCloud Code Analysis

on:
  push:
    branches: [ develop, main ]
  pull_request:
    branches: [ develop, main ]

jobs:
  sonarcloud:
    name: SonarCloud Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar dependencias y generar cobertura backend
        run: |
          cd backend
          npm install
          npx prisma generate
          npm run test:cov

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

## 📋 ¿Cómo Presentar el Resultado a tu Profesor?

1. **Captura del Quality Gate:** Muestra el panel principal de SonarQube con el sello verde **"Passed"**.
2. **Métricas Clave:**
   - **0 Vulnerabilidades** (evidencia de cumplimiento con las directivas de seguridad OWASP).
   - **0 Bugs** en código de producción.
   - **Mantenibilidad A** (Debt Ratio < 1%).
   - **Cobertura de Pruebas** respaldada por `coverage/lcov.info`.
3. **Descarga de Reporte:** Desde la consola de SonarQube puedes exportar el resumen en PDF o generar captura de pantalla para el informe final de entrega.

