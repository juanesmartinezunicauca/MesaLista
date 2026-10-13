@echo off
chcp 65001 >nul
echo =====================================================================
echo    🛡️ EJECUTOR DE AUDITORÍA DINÁMICA OWASP ZAP - MESA LISTA
echo =====================================================================
echo.

if not exist "reports\zap" (
    mkdir "reports\zap"
)

echo [1/3] Verificando Docker Desktop...
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] Docker no está ejecutándose en este momento.
    echo Asegúrate de abrir la aplicación 'Docker Desktop' en Windows.
    echo.
    echo Alternativamente, puedes usar la aplicación de escritorio de OWASP ZAP
    echo siguiendo los pasos detallados en: GUIA_OWASP_ZAP.md
    echo.
    pause
    exit /b 1
)

echo [2/3] Verificando conectividad con el backend local (http://localhost:3000)...
echo Asegúrate de tener el backend corriendo en otra terminal con: npm run start:dev
echo.

echo [3/3] Iniciando escáner ZAP Baseline contra la API...
docker run --rm -v "%cd%\reports\zap:/zap/wrk/:rw" zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:3000/api/v1/catalogo/productos -r reporte-owasp-zap.html

echo.
echo =====================================================================
echo    ✅ Auditoría ZAP finalizada.
echo    Reporte generado en: reports\zap\reporte-owasp-zap.html
echo =====================================================================
pause
