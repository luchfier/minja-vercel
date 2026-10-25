# scripts/setup-kiosk-autostart.ps1
# Script Otomasi Windows Kiosk Appliance untuk MinjaPhotobooth V2
# Menyiapkan auto-start, mencegah sleep/screen timeout, dan mengunci desktop Kiosk

param(
    [switch]$EnableAutoStart,
    [switch]$DisableSleep,
    [switch]$OptimizeKiosk
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     MinjaPhotobooth V2 — Windows Kiosk Appliance Setup   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Nonaktifkan Sleep / Layar Mati (Power Settings)
Write-Host "`n[1/3] Mengonfigurasi Power Management (Always On)..." -ForegroundColor White
try {
    # Standby-timeout AC = 0 (Never)
    powercfg /change standby-timeout-ac 0
    # Monitor-timeout AC = 0 (Never)
    powercfg /change monitor-timeout-ac 0
    # Disk-timeout AC = 0 (Never)
    powercfg /change disk-timeout-ac 0
    # Hibernate = Off
    powercfg /hibernate off
    Write-Host "  ✓ Power management berhasil diatur: Layar & PC tidak akan pernah sleep/mati." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Gagal mengatur powercfg: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Nonaktifkan Windows Error Reporting Popup
Write-Host "`n[2/3] Mengonfigurasi Windows Error Reporting (Silent Crash Handling)..." -ForegroundColor White
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\Windows Error Reporting"
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "DontShowUI" -Value 1 -Type DWord
    Set-ItemProperty -Path $regPath -Name "Disabled" -Value 1 -Type DWord
    Write-Host "  ✓ Windows Error Reporting dialog dinonaktifkan (mencegah popup liar di layar sentuh)." -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Gagal mengatur registry WER: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Buat Shortcut Auto-Start di folder Startup Windows
Write-Host "`n[3/3] Menyiapkan Auto-Start Kiosk saat Komputer Dinyalakan..." -ForegroundColor White
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupFolder "MinjaPhotobooth.lnk"
    
    $projectDir = Split-Path -Parent $PSScriptRoot
    $appExe = Join-Path $projectDir "dist-package\win-unpacked\MinjaPhotobooth.exe"
    
    # Jika build production exe belum ada, arahkan ke skrip kiosk runner
    if (-not (Test-Path $appExe)) {
        $runnerBat = Join-Path $projectDir "run-kiosk.bat"
        if (-not (Test-Path $runnerBat)) {
            "@echo off`r`ncd /d `"$projectDir`"`r`nnpm.cmd run kiosk`r`n" | Out-File -FilePath $runnerBat -Encoding ASCII
        }
        $targetPath = $runnerBat
    } else {
        $targetPath = $appExe
    }

    $wscript = New-Object -ComObject WScript.Shell
    $shortcut = $wscript.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $projectDir
    $shortcut.Description = "MinjaPhotobooth Standalone Kiosk Appliance"
    $shortcut.Save()

    Write-Host "  ✓ Shortcut Auto-Start berhasil dipasang di: $shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Gagal memasang shortcut startup: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " ✅ Pengaturan Kiosk Selesai! MinjaPhotobooth siap beroperasi 24/7." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
