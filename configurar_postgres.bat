@echo off
title Configurar PostgreSQL - MesaLista
echo ========================================================
echo   Configurando PostgreSQL para MesaLista
echo ========================================================
echo.

:: Solicitar permisos de administrador automaticamente si no los tiene
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

echo 1. Reiniciando servicio de PostgreSQL 18...
net stop postgresql-x64-18
net start postgresql-x64-18

echo.
echo 2. Configurando usuario 'postgres' con contrasena 'postgres'...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres';"

echo.
echo 3. Creando base de datos 'mesalista'...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE mesalista;" 2>nul

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
