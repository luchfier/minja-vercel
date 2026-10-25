# silent-print.ps1
# Script Silent Printing Gambar 4R untuk MinjaPhotobooth
# Menangani pencetakan borderless ke Windows Print Spooler tanpa popup dialog

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [string]$PrinterName = "",

    [Parameter(Mandatory=$false)]
    [int]$Copies = 1,

    [Parameter(Mandatory=$false)]
    [string]$PaperSizeName = "",

    [Parameter(Mandatory=$false)]
    [double]$PaperWidthMm = 0,

    [Parameter(Mandatory=$false)]
    [double]$PaperHeightMm = 0,

    [Parameter(Mandatory=$false)]
    [double]$PaperWidthCm = 0,

    [Parameter(Mandatory=$false)]
    [double]$PaperHeightCm = 0,

    [Parameter(Mandatory=$false)]
    [double]$MarginTopMm = 0,

    [Parameter(Mandatory=$false)]
    [double]$MarginLeftMm = 0,

    [Parameter(Mandatory=$false)]
    [double]$MarginTopCm = 0,

    [Parameter(Mandatory=$false)]
    [double]$MarginLeftCm = 0,

    [Parameter(Mandatory=$false)]
    [string]$Orientation = "auto"
)

$ErrorActionPreference = "Stop"

$img = $null
$doc = $null

try {
    if (-not (Test-Path $FilePath)) {
        throw "File gambar tidak ditemukan: $FilePath"
    }

    # Normalisasi cm ke mm jika parameter cm disediakan
    if ($PaperWidthCm -gt 1) { $PaperWidthMm = $PaperWidthCm * 10 }
    if ($PaperHeightCm -gt 1) { $PaperHeightMm = $PaperHeightCm * 10 }
    if ($MarginTopCm -ne 0 -and $MarginTopMm -eq 0) { $MarginTopMm = $MarginTopCm * 10 }
    if ($MarginLeftCm -ne 0 -and $MarginLeftMm -eq 0) { $MarginLeftMm = $MarginLeftCm * 10 }

    Add-Type -AssemblyName System.Drawing

    $doc = New-Object System.Drawing.Printing.PrintDocument

    # Jika PrinterName tidak diberikan, gunakan default printer Windows
    if ([string]::IsNullOrWhiteSpace($PrinterName)) {
        $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1
        if ($defaultPrinter) {
            $PrinterName = $defaultPrinter.Name
        } else {
            throw "Tidak ada printer default yang terkonfigurasi di Windows."
        }
    }

    $doc.PrinterSettings.PrinterName = $PrinterName

    if (-not $doc.PrinterSettings.IsValid) {
        throw "Printer '$PrinterName' tidak valid atau tidak dapat diakses."
    }

    $doc.PrinterSettings.Copies = [int]$Copies
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

    # Deteksi atau buat PaperSize kustom
    $targetPaper = $null
    if ($PaperWidthMm -gt 10 -and $PaperHeightMm -gt 10) {
        # Custom paper dimensions (1/100 inch dari cm/mm)
        $wHundredth = [int][Math]::Round(($PaperWidthMm / 25.4) * 100)
        $hHundredth = [int][Math]::Round(($PaperHeightMm / 25.4) * 100)
        $pCustomName = if ([string]::IsNullOrWhiteSpace($PaperSizeName)) { "Custom 10x15 cm" } else { $PaperSizeName }
        $targetPaper = New-Object System.Drawing.Printing.PaperSize($pCustomName, $wHundredth, $hHundredth)
        $doc.DefaultPageSettings.PaperSize = $targetPaper
    } else {
        # Deteksi ukuran kertas dari driver printer (10x15, 10x15cm, 4x6, A4, Postcard, dll)
        $searchKey = if ([string]::IsNullOrWhiteSpace($PaperSizeName)) { "10x15" } else { $PaperSizeName.ToLower() }
        foreach ($paper in $doc.PrinterSettings.PaperSizes) {
            $pName = $paper.PaperName.ToLower()
            if ($pName -match $searchKey -or $pName -match "10x15" -or $pName -match "10×15" -or $pName -match "4x6" -or $pName -match "postcard" -or $pName -match "kg") {
                $targetPaper = $paper
                break
            }
        }
        if ($targetPaper -ne $null) {
            $doc.DefaultPageSettings.PaperSize = $targetPaper
        }
    }

    # Muat file gambar
    $img = [System.Drawing.Image]::FromFile($FilePath)

    # Sesuaikan orientasi landscape vs portrait
    if ($Orientation -eq "portrait") {
        $doc.DefaultPageSettings.Landscape = $false
    } elseif ($Orientation -eq "landscape") {
        $doc.DefaultPageSettings.Landscape = $true
    } else {
        if ($img.Width -gt $img.Height) {
            $doc.DefaultPageSettings.Landscape = $true
        } else {
            $doc.DefaultPageSettings.Landscape = $false
        }
    }

    # Hitung offset margin kalibrasi (dalam 1/100 inci)
    $offsetX = [int][Math]::Round(($MarginLeftMm / 25.4) * 100)
    $offsetY = [int][Math]::Round(($MarginTopMm / 25.4) * 100)

    # Pasang handler PrintPage untuk menggambar gambar ke kanvas printer borderless
    $doc.add_PrintPage({
        param($sender, $ev)
        $bounds = $ev.PageBounds
        $destRect = New-Object System.Drawing.Rectangle($bounds.X + $offsetX, $bounds.Y + $offsetY, $bounds.Width, $bounds.Height)
        $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $ev.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $ev.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $ev.Graphics.DrawImage($img, $destRect)
        $ev.HasMorePages = $false
    })

    # Cek apakah printer adalah PDF virtual (hindari modal 'Save As' di mode simulasi/pengembangan)
    if ($PrinterName -match "PDF" -or $PrinterName -match "XPS") {
        $outDir = Split-Path -Parent $FilePath
        $outPdf = Join-Path $outDir ("simulated_print_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".pdf")
        $doc.PrinterSettings.PrintToFile = $true
        $doc.PrinterSettings.PrintFileName = $outPdf
    }

    # Eksekusi pencetakan silent
    $doc.Print()

    $result = @{
        success = $true
        printer = $PrinterName
        copies = $Copies
        filePath = $FilePath
        paper = if ($targetPaper) { $targetPaper.PaperName } else { "Default" }
        timestamp = (Get-Date).ToString("o")
    }

    Write-Output (ConvertTo-Json -Compress $result)
}
catch {
    $err = @{
        success = $false
        error = $_.Exception.Message
        printer = $PrinterName
        filePath = $FilePath
    }
    Write-Output (ConvertTo-Json -Compress $err)
    exit 1
}
finally {
    # Pastikan file handle selalu dilepas agar tidak terkunci di Windows
    if ($img -ne $null) {
        try { $img.Dispose() } catch {}
    }
    if ($doc -ne $null) {
        try { $doc.Dispose() } catch {}
    }
}
