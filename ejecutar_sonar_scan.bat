@echo off
chcp 65001 >nul
echo =====================================================================
echo    📊 EJECUTOR DE ANÁLISIS DE CÓDIGO CON SONARQUBE - MESA LISTA
echo =====================================================================
echo.

set "SONAR_HOST=http://localhost:9000"
set "SONAR_TOKEN=%1"

if "%SONAR_TOKEN%"=="" (
    echo [PASO PREVIO] Introduce el Token de autenticación de SonarQube.
    echo (Puedes generarlo en: http://localhost:9000 -> Perfil -> Security -> Generate Token)
    echo.
    set /p "SONAR_TOKEN=Pega tu Token de SonarQube: "
)

if "%SONAR_TOKEN%"=="" (
    echo.
    echo [ERROR] No se suministró un Token de análisis. Operación cancelada.
    echo.
    pause
    exit /b 1
)

echo.
echo [1/3] Verificando servidor de SonarQube en %SONAR_HOST%...
curl -s -m 5 %SONAR_HOST%/api/system/status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] No se pudo verificar respuesta inmediata de %SONAR_HOST%.
    echo Si acabas de iniciar SonarQube con 'iniciar_sonarqube.bat', espera 30 segundos.
    echo.
)

echo [2/3] Generando métricas de cobertura de pruebas unitarias (LCOV)...
if exist "backend\package.json" (
    cmd /c "cd backend && npm run test:cov -- --passWithNoTests" >nul 2>&1
    if exist "backend\coverage\lcov.info" (
        echo      -> Reporte de cobertura generado exitosamente en backend\coverage\lcov.info
    ) else (
        echo      -> Continuando sin reporte LCOV previo (se analizarán reglas estáticas de código).
    )
)

echo.
echo [3/3] Ejecutando SonarScanner...
docker ps >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Ejecutando escaneo a través del contenedor oficial de SonarSource...
    docker run --rm --network host -v "%cd%:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.host.url="%SONAR_HOST%" -Dsonar.token="%SONAR_TOKEN%"
) else (
    echo Docker no detectado. Intentando ejecución directa mediante npx...
    call npx sonar-scanner -Dsonar.host.url="%SONAR_HOST%" -Dsonar.token="%SONAR_TOKEN%"
)

echo.
echo =====================================================================
echo    ✅ Análisis finalizado.
echo    Revisa el Quality Gate y las métricas en:
echo    👉 %SONAR_HOST%/dashboard?id=mesalista-pos
echo =====================================================================
echo.
pause

