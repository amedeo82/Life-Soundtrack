#!/usr/bin/env pwsh
# Test per issue #58: StringBuilder.AppendLine aggiunge CRLF su Windows.
# Verifica che il fix (sostituire AppendLine con Append(... + "`n")) produca
# output LF-only.
#
# Uso: pwsh scripts/test-appendline-lf-fix.ps1
# Requisiti: pwsh (PowerShell 5.1 o Core)

$ErrorActionPreference = "Stop"
$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath

$PASS = 0
$FAIL = 0
$TOTAL = 0

function pass($msg) {
    $script:PASS++
    $script:TOTAL++
    Write-Host "  [PASS] $msg" -ForegroundColor Green
}
function fail($msg, $detail) {
    $script:FAIL++
    $script:TOTAL++
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    Write-Host "         $detail"
}

# Test 1: AppendLine su Windows produce CRLF
Write-Host ""
Write-Host "Scenario S1: AppendLine Windows default"
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("test")
$result = $sb.ToString()
$crCount = ($result.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
$lfCount = ($result.ToCharArray() | Where-Object { $_ -eq [char]10 }).Count
if ($crCount -gt 0 -and $lfCount -gt 0) {
    pass "AppendLine aggiunge CRLF su Windows (CR=$crCount, LF=$lfCount)"
} else {
    Write-Host "  [INFO] Ambiente: AppendLine non aggiunge CRLF (forse non Windows). CR=$crCount LF=$lfCount"
    Write-Host "         Test skip su questo OS"
}

# Test 2: Append(... + "`n") produce solo LF
Write-Host ""
Write-Host "Scenario S2: Append + LF esplicito"
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("test" + "`n")
$result = $sb.ToString()
$crCount = ($result.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
$lfCount = ($result.ToCharArray() | Where-Object { $_ -eq [char]10 }).Count
if ($crCount -eq 0 -and $lfCount -eq 1) {
    pass "Append + LF produce solo LF (CR=$crCount, LF=$lfCount)"
} else {
    fail "S2" "atteso CR=0 LF=1, trovato CR=$crCount LF=$lfCount"
}

# Test 3: aggregator (su main dopo il fix) non usa piu AppendLine
Write-Host ""
Write-Host "Scenario S3: scripts/aggregate-state.ps1 non usa AppendLine (escludendo commenti)"
$aggregatorPath = Join-Path $scriptDir "aggregate-state.ps1"
if (Test-Path $aggregatorPath) {
    $content = Get-Content $aggregatorPath -Raw
    # Rimuovi commenti <# ... #> e righe di commento #
    $codeOnly = $content -replace '<#[\s\S]*?#>', ''
    $codeOnly = $codeOnly -replace '(?m)^\s*#[^\r\n]*', ''
    $appendLineCount = ([regex]::Matches($codeOnly, 'AppendLine')).Count
    if ($appendLineCount -eq 0) {
        pass "aggregate-state.ps1 non contiene AppendLine in codice (0 occorrenze)"
    } else {
        fail "S3" "aggregate-state.ps1 contiene ancora $appendLineCount AppendLine nel codice"
    }
} else {
    fail "S3" "$aggregatorPath non trovato"
}

# Test 4: generate-bundle (su main dopo il fix) ha il -replace CRLF, LF
Write-Host ""
Write-Host "Scenario S4: scripts/generate-bundle.ps1 normalizza CRLF"
$bundlePath = Join-Path $scriptDir "generate-bundle.ps1"
if (Test-Path $bundlePath) {
    $content = Get-Content $bundlePath -Raw
    if ($content -match '-replace\s+"`r`n",\s+"`n"') {
        pass "generate-bundle.ps1 ha -replace CRLF, LF"
    } else {
        fail "S4" "generate-bundle.ps1 non ha -replace CRLF, LF"
    }
} else {
    fail "S4" "$bundlePath non trovato"
}

# Test 5: end-to-end - run aggregator, check SESSIONS.md block has 0 CR
Write-Host ""
Write-Host "Scenario S5: aggregator end-to-end produce block LF-only"
if (Test-Path $aggregatorPath) {
    # Reset SESSIONS.md to HEAD
    git checkout -- docs/SESSIONS.md 2>&1 | Out-Null
    # Run aggregator (powershell 5.1 o pwsh, dipende da ambiente)
    $psCmd = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($psCmd) {
        & pwsh $aggregatorPath 2>&1 | Out-Null
    } else {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $aggregatorPath 2>&1 | Out-Null
    }
    # Check block encoding
    $sessPath = Join-Path (Get-Location) "docs/SESSIONS.md"
    if (Test-Path $sessPath) {
        $content = Get-Content $sessPath -Raw -Encoding UTF8
        $startMarker = "<!-- AGGREGATE-SESSIONS-START -->"
        $endMarker = "<!-- AGGREGATE-SESSIONS-END -->"
        $sIdx = $content.IndexOf($startMarker)
        $eIdx = $content.IndexOf($endMarker, $sIdx)
        $block = $content.Substring($sIdx, $eIdx - $sIdx + $endMarker.Length)
        $crInBlock = ($block.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
        if ($crInBlock -eq 0) {
            pass "SESSIONS.md block ha 0 CR dopo aggregator (LF only)"
        } else {
            fail "S5" "SESSIONS.md block ha $crInBlock CR dopo aggregator"
        }
    } else {
        fail "S5" "$sessPath non trovato"
    }
} else {
    fail "S5" "$aggregatorPath non trovato"
}

Write-Host ""
Write-Host "=============================================="
Write-Host "Risultato: $PASS passati, $FAIL falliti su $TOTAL scenari"
Write-Host "=============================================="
if ($FAIL -gt 0) { exit 1 } else { exit 0 }
