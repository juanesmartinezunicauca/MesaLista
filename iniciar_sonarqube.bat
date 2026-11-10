@echo off
chcp 65001 >nul
echo =====================================================================
echo    🚀 INICIALIZADOR DE SERVIDOR SONARQUBE LOCAL - MESA LISTA
echo =====================================================================
echo.

echo [1/3] Verificando Docker Desktop...
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker no está ejecutándose en este momento.
    echo Asegúrate de abrir la aplicación 'Docker Desktop' en Windows.
    echo.
    pause
    exit /b 1
)

echo [2/3] Comprobando contenedor de SonarQube...
docker ps -a --format "{{.Names}}" | findstr /I "^sonarqube$" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo El contenedor 'sonarqube' ya existe. Iniciando...
    docker start sonarqube >nul 2>&1
) else (
    echo Descargando e iniciando SonarQube Community LTS en Docker...
    docker run -d --name sonarqube -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:lts-community
)

echo.
echo [3/3] Servidor SonarQube levantado con éxito.
echo =====================================================================
echo    🌐 URL de la Consola: http://localhost:9000
echo    👤 Usuario inicial:   admin
echo    🔑 Contraseña:        admin (Te pedirá cambiarla en el primer ingreso)
echo =====================================================================
echo.
echo Espera aproximadamente 30 a 60 segundos mientras el servicio inicializa.
echo Luego abre http://localhost:9000 en tu navegador web.
echo.
echo Para generar el Token de análisis:
echo   1. Ingresa a: http://localhost:9000
echo   2. Ve a: Mi Perfil (Avatar superior derecho) -> Security -> Generate Token
echo   3. Copia el token para usarlo con: ejecutar_sonar_scan.bat
echo.
pause

