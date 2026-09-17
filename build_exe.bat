@echo off
title Build PDF Anti Plenger Launcher
cd /d "%~dp0"

echo ===================================================
echo     Membangun PDF_Anti_Plenger.exe ...
echo ===================================================

set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%CSC_PATH%" (
    set CSC_PATH=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
)

if not exist "%CSC_PATH%" (
    echo [ERROR] Kompilator csc.exe tidak ditemukan.
    pause
    exit /b 1
)

"%CSC_PATH%" /target:winexe /optimize /r:System.dll,System.Drawing.dll,System.Windows.Forms.dll /out:PDF_Anti_Plenger.exe Launcher.cs

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUKSES] PDF_Anti_Plenger.exe berhasil dibuat!
    echo Anda dapat langsung menjalankan PDF_Anti_Plenger.exe sekarang.
) else (
    echo.
    echo [ERROR] Kompilasi gagal.
)

echo ===================================================
exit /b 0
