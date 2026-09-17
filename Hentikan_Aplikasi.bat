@echo off
title Hentikan PDF ANTI PLENGER
cd /d "%~dp0"

echo Menghentikan server PDF ANTI PLENGER...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4321 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo Server telah dimatikan.
exit /b 0
