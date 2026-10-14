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

$bundle = "# BUNDLE CONTENUTO`n`n"
$bundle += "> Generato automaticamente da scripts/generate-bundle.ps1`n"
$bundle += "> Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n`n"

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $bundle += "===== FILE: $file =====`n`n"
        $bundle += $content
        $bundle += "`n`n"
    } else {
        Write-Host "File mancante: $file" -ForegroundColor Yellow
    }
}

$bundle | Out-File -FilePath $outputFile -Encoding utf8
Write-Host "Bundle generato in $outputFile" -ForegroundColor Green