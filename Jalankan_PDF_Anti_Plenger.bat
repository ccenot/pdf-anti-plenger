@echo off
title PDF ANTI PLENGER
cd /d "%~dp0"

echo ===================================================================
echo                     PDF ANTI PLENGER
echo ===================================================================
echo.
echo Sedang menyiapkan aplikasi...

:: 1. Tentukan binary Node.js (Gunakan runtime bawaan jika ada agar portable)
set "NODE_CMD=node"
if exist "%~dp0runtime\node.exe" (
    set "NODE_CMD=%~dp0runtime\node.exe"
)

:: 2. Buka browser otomatis setelah jeda singkat
start /b "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1200; Start-Process 'http://localhost:4321'"

:: 3. Jalankan server aplikasi
echo Server aktif. Browser akan terbuka otomatis di http://localhost:4321...
echo.
echo (Biarkan jendela ini tetap terbuka selama menggunakan aplikasi)
echo Tekan tombol silang [X] atau Ctrl+C jika ingin menutup aplikasi.
echo ===================================================================
echo.

"%NODE_CMD%" app_server.js

pause
