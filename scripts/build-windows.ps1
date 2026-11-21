# build-windows.ps1 — Menyiapkan paket distribusi KasirIn untuk Windows.
#
# Jalankan dari akar repositori (atau lewat path apa pun):
#   powershell -File scripts/build-windows.ps1
#
# Menghasilkan:
#   dist-windows/KasirIn/              -> folder staging (isi paket)
#   dist-windows/KasirIn-windows.zip   -> arsip portabel
#   dist-windows/KasirIn-Setup.exe     -> installer NSIS (jika makensis tersedia)
#
# Catatan: skrip ini ditujukan untuk Windows. NSIS/makensis bersifat opsional.

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DistRoot = Join-Path $RepoRoot 'dist-windows'
$Staging  = Join-Path $DistRoot 'KasirIn'
$ZipPath  = Join-Path $DistRoot 'KasirIn-windows.zip'

function Info($pesan) { Write-Host "[INFO]  $pesan" -ForegroundColor Cyan }
function Selesai($pesan) { Write-Host "[OK]    $pesan" -ForegroundColor Green }
function Peringatan($pesan) { Write-Host "[PERINGATAN] $pesan" -ForegroundColor Yellow }
function Gagal($pesan) { Write-Host "[GAGAL] $pesan" -ForegroundColor Red; exit 1 }

try {
    # === 1. Cek versi Node.js minimal 22 ===
    Info 'Memeriksa Node.js (minimal versi 22)...'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Gagal 'Node.js tidak ditemukan. Pasang Node.js 22 atau lebih baru dari https://nodejs.org/'
    }

    $versiMentah = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0) {
        Gagal "Gagal membaca versi Node.js. Pasang Node.js 22 atau lebih baru dari https://nodejs.org/"
    }

    $major = 0
    if ([int]::TryParse(($versiMentah -replace '^v', '').Split('.')[0], [ref]$major)) {
        if ($major -lt 22) {
            Gagal "Node.js versi $versiMentah terdeteksi. KasirIn membutuhkan Node.js 22 atau lebih baru. Unduh di https://nodejs.org/"
        }
    } else {
        Gagal "Tidak dapat mengenali versi Node.js ('$versiMentah'). Pasang Node.js 22 atau lebih baru."
    }
    Selesai "Node.js $versiMentah terdeteksi."

    # === 2. Pasang dependensi dan build ===
    Push-Location $RepoRoot
    try {
        # npm ci --ignore-scripts dipakai karena node-gyp bawaan npm belum
        # mendeteksi Visual Studio 2026. Modul native dan esbuild dipasang
        # terpisah memakai node-gyp 13.
        Info 'Menjalankan npm ci --ignore-scripts ...'
        & npm ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) { Gagal 'npm ci gagal. Periksa koneksi internet dan package-lock.json.' }

        Info 'Mengompilasi better-sqlite3 dengan node-gyp 13 ...'
        & npx --yes node-gyp@13 rebuild --directory node_modules/better-sqlite3
        if ($LASTEXITCODE -ne 0) { Gagal 'Gagal mengompilasi better-sqlite3. Pasang Visual Studio dengan workload Desktop development with C++.' }

        Info 'Memasang biner esbuild ...'
        & node node_modules/esbuild/install.js
        if ($LASTEXITCODE -ne 0) { Gagal 'Gagal memasang biner esbuild.' }

        Info 'Menjalankan npm run build ...'
        & npm run build
        if ($LASTEXITCODE -ne 0) { Gagal 'npm run build gagal. Periksa keluaran build di atas.' }
    } finally {
        Pop-Location
    }
    Selesai 'Build server dan web selesai.'

    # === 3. Siapkan folder staging ===
    Info "Menyiapkan folder staging: $Staging"
    if (Test-Path $DistRoot) { Remove-Item $DistRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $Staging -Force | Out-Null

    # Berkas/folder yang disalin ke dalam paket.
    $isiPaket = @(
        @{ Dari = 'apps/server/dist';  Ke = 'apps/server/dist' },
        @{ Dari = 'apps/web/dist';     Ke = 'apps/web/dist' },
        @{ Dari = 'package.json';      Ke = 'package.json' },
        @{ Dari = 'package-lock.json'; Ke = 'package-lock.json' },
        # node_modules sengaja tidak dibundel. Pengguna menjalankan npm ci sekali
        # di komputernya; panduan ada di README dan docs/DEPLOYMENT.md.
        @{ Dari = 'start.bat';         Ke = 'start.bat' },
        @{ Dari = 'LICENSE';           Ke = 'LICENSE' },
        @{ Dari = 'README.md';         Ke = 'README.md' },
        @{ Dari = '.env.example';      Ke = '.env.example' }
    )

    foreach ($item in $isiPaket) {
        $sumber = Join-Path $RepoRoot $item.Dari
        $tujuan = Join-Path $Staging $item.Ke
        if (-not (Test-Path $sumber)) {
            Gagal "Tidak ditemukan: $($item.Dari). Pastikan build berhasil sebelum membuat paket."
        }
        $induk = Split-Path -Parent $tujuan
        New-Item -ItemType Directory -Path $induk -Force | Out-Null
        Copy-Item -Path $sumber -Destination $tujuan -Recurse -Force
    }
    Selesai 'Berkas aplikasi disalin ke staging.'

    # === 4. Peluncur run.cmd untuk paket ===
    # run.cmd mengarahkan folder data ke %LOCALAPPDATA%\KasirIn\data lalu
    # menjalankan server hasil build langsung dengan node.
    $isiRunCmd = @'
@echo off
title KasirIn - Peluncur Paket Windows

rem === Arahkan folder data ke lokasi data aplikasi ===
if "%KASIRIN_DATA_DIR%"=="" set "KASIRIN_DATA_DIR=%LOCALAPPDATA%\KasirIn\data"

rem === Pastikan dijalankan dari akar paket ===
cd /d "%~dp0"

echo Folder data : %KASIRIN_DATA_DIR%
echo Menjalankan KasirIn...
echo.

node apps/server/dist/index.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] KasirIn gagal dijalankan. Pastikan Node.js 22 atau lebih baru terpasang.
    pause
    exit /b 1
)

echo.
echo KasirIn telah berhenti.
pause
'@
    Set-Content -Path (Join-Path $Staging 'run.cmd') -Value $isiRunCmd -Encoding ASCII
    Selesai 'run.cmd dibuat.'

    # === 5. Arsip ZIP portabel ===
    Info "Membuat arsip ZIP: $ZipPath"
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    Compress-Archive -Path (Join-Path $Staging '*') -DestinationPath $ZipPath -CompressionLevel Optimal
    Selesai "ZIP dibuat: $ZipPath"

    # === 6. Installer NSIS (opsional) ===
    $makensis = Get-Command makensis -ErrorAction SilentlyContinue
    if (-not $makensis -and (Test-Path 'C:\Program Files (x86)\NSIS\makensis.exe')) {
        $makensis = 'C:\Program Files (x86)\NSIS\makensis.exe'
    }
    if (-not $makensis) {
        Peringatan 'makensis (NSIS) tidak ditemukan — installer .exe dilewati (opsional).'
        Peringatan 'Pasang NSIS dari https://nsis.sourceforge.io/ lalu jalankan ulang skrip ini untuk membuat installer.'
    } else {
        Info 'Membuat installer NSIS (KasirIn-Setup.exe) ...'
        Push-Location (Join-Path $RepoRoot 'installer')
        try {
            & $makensis kasirin.nsi
            if ($LASTEXITCODE -ne 0) { Gagal 'makensis gagal membuat installer. Periksa keluaran di atas.' }
        } finally {
            Pop-Location
        }
        Selesai "Installer dibuat: $(Join-Path $DistRoot 'KasirIn-Setup.exe')"
    }

    Selesai "Selesai. Paket distribusi ada di: $DistRoot"
} catch {
    Gagal "Terjadi kesalahan tak terduga: $($_.Exception.Message)"
}
