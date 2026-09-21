$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   MEMBUAT BUNDLE PORTABLE (PDF ANTI PLENGER)     " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$stagingDir = Join-Path $env:TEMP "pdf_portable_staging"
if (Test-Path $stagingDir) {
    Remove-Item -Recurse -Force $stagingDir
}

$bundleDir = Join-Path $stagingDir "PDF_Anti_Plenger_PORTABLE"
New-Item -ItemType Directory -Path $bundleDir | Out-Null

$itemsToCopy = @(
    "PDF_Anti_Plenger.exe",
    "app_server.js",
    "core_splitter.js",
    "config.json",
    "dialog_helper.ps1",
    "PANDUAN_PENGGUNAAN.txt",
    "Jalankan_PDF_Anti_Plenger.bat",
    "Hentikan_Aplikasi.bat",
    "Jalankan_Tanpa_Layar_Hitam.vbs",
    "package.json",
    "public",
    "runtime",
    "node_modules",
    "uploads"
)

Write-Host "Menyalin file aplikasi ke staging..." -ForegroundColor Yellow
foreach ($item in $itemsToCopy) {
    $src = Join-Path $PSScriptRoot $item
    $dst = Join-Path $bundleDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
    } else {
        Write-Warning "Item tidak ditemukan: $src"
    }
}

# Verifikasi folder scoped (@pdf-lib, etc.)
$atDirs = Get-ChildItem -Path (Join-Path $bundleDir "node_modules") -Filter "@*"
Write-Host "Scoped packages di staging:" ($atDirs.Name -join ", ") -ForegroundColor Green

if ($atDirs.Count -eq 0) {
    throw "ERROR KRITIS: Modul @* tidak ditemukan di node_modules staging!"
}

$zipOutput = Join-Path $PSScriptRoot "PDF_Anti_Plenger_PORTABLE.zip"
if (Test-Path $zipOutput) {
    Remove-Item -Force $zipOutput
}

Write-Host "Membuat file ZIP kompresi optimal..." -ForegroundColor Yellow
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($bundleDir, $zipOutput, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSize = (Get-Item $zipOutput).Length / 1MB
Write-Host ("SUKSES! ZIP selesai dibuat: " + [math]::Round($zipSize, 2) + " MB") -ForegroundColor Green
Write-Host "Lokasi: $zipOutput" -ForegroundColor Cyan

# Cleanup staging
Remove-Item -Recurse -Force $stagingDir
Write-Host "Staging dibersihkan."
