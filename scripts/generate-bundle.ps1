# PowerShell script per generare docs/BUNDLE.md con tutti i file concatenati

$outputFile = "docs/BUNDLE.md"
$files = @(
    "AGENTS.md",
    "README.md",
    "docs/INDEX.md",
    "docs/SESSIONS.md",
    "docs/00-VISION.md",
    "docs/01-PLATFORMS.md",
    "docs/02-DATA-SCHEMA.md",
    "docs/03-ADAPTERS/SPEC-TEMPLATE.md",
    "docs/03-ADAPTERS/spotify.md",
    "docs/04-ANALYSIS-ALGORITHMS.md",
    "docs/05-ARCHITECTURE.md",
    "docs/06-UX-FLOWS-STATES.md",
    "docs/08-COPY-I18N.md",
    "docs/10-TESTING.md",
    "docs/11-BACKLOG.md",
    "docs/13-ADR/0001-pwa-first.md",
    "docs/13-ADR/0002-local-first.md",
    "docs/13-ADR/0003-adapter-pattern.md",
    "docs/14-GLOSSARY.md",
    "docs/15-DESIGN-SYSTEM.md",
    "fixtures/synthetic-history/spotify-sample.json"
)

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$fileCount = $files.Count

$header = "# BUNDLE CONTENUTO`n`n"
$header += "> Generato automaticamente da scripts/generate-bundle.ps1`n"
$header += "> Data: $timestamp`n"
$header += "> Totale file: $fileCount`n"

$bundle = $header

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        $bundle += "`n`n===== FILE: $file =====`n`n"
        $bundle += $content
        $bundle += "`n"
        Write-Host "[OK] $file" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $file" -ForegroundColor Yellow
    }
}

$bundle | Out-File -FilePath $outputFile -Encoding utf8
Write-Host "Bundle generato in $outputFile" -ForegroundColor Cyan