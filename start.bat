@echo off
title KasirIn - Peluncur Windows

echo ============================================
echo   KasirIn - POS untuk UMKM F&B Indonesia
echo ============================================
echo.

rem === Cek keberadaan Node.js ===
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js tidak ditemukan di sistem.
    echo Silakan pasang Node.js versi 22 atau lebih baru dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

rem === Cek versi Node.js minimal 22 ===
for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_MAJOR=%%v
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 22 (
    echo [ERROR] Node.js versi 22 atau lebih baru dibutuhkan.
    echo Versi terpasang: v%NODE_MAJOR%
    echo Silakan unduh versi terbaru dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

rem === Arahkan folder data ke lokasi lokal aplikasi ===
if "%KASIRIN_DATA_DIR%"=="" set "KASIRIN_DATA_DIR=%LOCALAPPDATA%\KasirIn\data"
echo Folder data : %KASIRIN_DATA_DIR%

rem === Pastikan dijalankan dari akar repositori ===
cd /d "%~dp0"

echo Menjalankan KasirIn...
echo.
call npm run start:prod

echo.
echo KasirIn telah berhenti.
pause
