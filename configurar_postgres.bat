@echo off
setlocal EnableDelayedExpansion
title Configurar PostgreSQL - MesaLista
echo ========================================================
echo   Configurando PostgreSQL para MesaLista
echo ========================================================
echo.

:: Solicitar permisos de administrador automaticamente si no los tiene
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"

:: 1. Detectar instalacion de PostgreSQL
set "PSQL_BIN="
set "PG_VER="

for %%V in (18 17 16 15 14) do (
    if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" (
        if not defined PSQL_BIN (
            set "PSQL_BIN=C:\Program Files\PostgreSQL\%%V\bin\psql.exe"
            set "PG_VER=%%V"
        )
    )
)

if not defined PSQL_BIN (
    for /f "delims=" %%I in ('where psql 2^>nul') do (
        if not defined PSQL_BIN set "PSQL_BIN=%%I"
    )
)

if not defined PSQL_BIN (
    echo [ERROR] No se encontro psql.exe en C:\Program Files\PostgreSQL\ ni en el PATH.
    echo Asegurese de tener instalado PostgreSQL en este equipo.
    echo.
    pause
    exit /b 1
)

echo PostgreSQL detectado: !PSQL_BIN!
echo.

:: 2. Asegurar que el servicio este iniciado
if defined PG_VER (
    echo Verificando servicio postgresql-x64-!PG_VER!...
    sc query "postgresql-x64-!PG_VER!" >nul 2>&1
    if !errorLevel! equ 0 (
        net start postgresql-x64-!PG_VER! >nul 2>&1
    )
)

:: 3. Probar conexion con contrasena 'postgres'
echo.
echo Verificando acceso con usuario 'postgres'...
set "PGPASSWORD=postgres"
"!PSQL_BIN!" -U postgres -h 127.0.0.1 -p 5432 -c "SELECT 1;" >nul 2>&1

if !errorLevel! equ 0 (
    echo Acceso correcto con contrasena 'postgres'.
    goto create_db
)

echo.
echo ========================================================
echo [AVISO] La contrasena 'postgres' no coincide.
echo Al instalar PostgreSQL en este PC se definio otra contrasena.
echo ========================================================
echo.
set /p "CURRENT_PW=Escribe la contrasena que pusiste al instalar PostgreSQL: "

set "PGPASSWORD=!CURRENT_PW!"
"!PSQL_BIN!" -U postgres -h 127.0.0.1 -p 5432 -c "SELECT 1;" >nul 2>&1

if !errorLevel! neq 0 (
    echo.
    echo ========================================================
    echo [ERROR] La contrasena ingresada no es correcta.
    echo.
    echo Si no recuerdas que contrasena pusiste, puedes:
    echo 1. Cambiar la contrasena en 'MesaLista\backend\.env' en DATABASE_URL
    echo    poniendo la contrasena que recuerdes.
    echo 2. O restablecerla editando 'pg_hba.conf' a metodo 'trust'.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

echo.
echo Contrasena correcta. Configurando usuario 'postgres' con contrasena 'postgres'...
"!PSQL_BIN!" -U postgres -h 127.0.0.1 -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres';"

if !errorLevel! equ 0 (
    echo Contrasena actualizada a 'postgres' con exito.
    set "PGPASSWORD=postgres"
) else (
    echo No se pudo cambiar la contrasena. Continuando con la contrasena actual...
)

:create_db
echo.
echo Verificando base de datos 'mesalista'...
"!PSQL_BIN!" -U postgres -h 127.0.0.1 -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = 'mesalista';" | findstr "1" >nul 2>&1

if !errorLevel! neq 0 (
    echo Creando base de datos 'mesalista'...
    "!PSQL_BIN!" -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE mesalista;"
    if !errorLevel! equ 0 (
        echo Base de datos 'mesalista' creada con exito.
    ) else (
        echo [ERROR] No se pudo crear la base de datos 'mesalista'.
    )
) else (
    echo La base de datos 'mesalista' ya existe.
)

echo.
echo ========================================================
echo   LISTO! PostgreSQL quedo configurado exitosamente:
echo     Usuario:     postgres
echo     Contrasena:  postgres
echo     Base Datos:  mesalista
echo     Puerto:      5432
echo ========================================================
echo.
pause
