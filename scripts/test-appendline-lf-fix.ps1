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

# Test 3: il path di SCRITTURA dell'aggregator normalizza CRLF -> LF.
#
# Sessione 73 (issue #224): l'aspettativa originale ("0 occorrenze di
# AppendLine nel codice") era STALE: il fix dell'issue #58 non ha eliminato
# `AppendLine`, ha normalizzato CRLF->LF nel path di scrittura (e i 64
# `AppendLine` rimasti sono la forma *corretta* del fix, non una regressione).
# L'invariante che conta e' "l'output scritto e' LF-only", ed e' verificata
# end-to-end dallo scenario S5. Qui si verifica che il path di scrittura
# contenga la normalizzazione.
Write-Host ""
Write-Host "Scenario S3: scripts/aggregate-state.ps1 normalizza CRLF->LF in scrittura"
$aggregatorPath = Join-Path $scriptDir "aggregate-state.ps1"
if (Test-Path $aggregatorPath) {
    $content = Get-Content $aggregatorPath -Raw
    # Accetta entrambe le forme equivalenti: `-replace "`r`n", "`n"` (regex,
    # forma originale) e `.Replace("`r`n", "`n")` (ordinale, forma veloce
    # introdotta dalla Sessione 73).
    $hasNormalize = ($content -match '-replace\s+"`r`n",\s*"`n"') -or ($content -match '\.Replace\("`r`n",\s*"`n"\)')
    if ($hasNormalize) {
        pass "aggregate-state.ps1 normalizza CRLF->LF nel path di scrittura"
    } else {
        fail "S3" "aggregate-state.ps1 non contiene alcuna normalizzazione CRLF->LF in scrittura"
    }
} else {
    fail "S3" "$aggregatorPath non trovato"
}

# Test 4: generate-bundle (su main dopo il fix) ha la normalizzazione CRLF
Write-Host ""
Write-Host "Scenario S4: scripts/generate-bundle.ps1 normalizza CRLF"
$bundlePath = Join-Path $scriptDir "generate-bundle.ps1"
if (Test-Path $bundlePath) {
    $content = Get-Content $bundlePath -Raw
    # Entrambe le forme sono accettate (vedi S3): l'invariante e' la
    # normalizzazione, non la sua forma sintattica.
    if (($content -match '-replace\s+"`r`n",\s+"`n"') -or ($content -match '\.Replace\("`r`n",\s*"`n"\)')) {
        pass "generate-bundle.ps1 normalizza CRLF->LF"
    } else {
        fail "S4" "generate-bundle.ps1 non normalizza CRLF->LF"
    }
} else {
    fail "S4" "$bundlePath non trovato"
}

# Test 5: end-to-end - run aggregator in un fixture temporaneo, check SESSIONS.md
# block has 0 CR.
#
# Sessione 73 (issue #224): la versione precedente eseguiva l'aggregator
# DENTRO il working tree del repo (`git checkout -- docs/SESSIONS.md` + run),
# lasciando il tree modificato e sporco al termine del test: in CI questo
# rendeva il tree non riproducibile per gli step successivi. Ora il test gira
# su una COPIA temporanea del minimo necessario (script + sorgenti di stato +
# file target), quindi il working tree del repo non e' mai toccato.
Write-Host ""
Write-Host "Scenario S5: aggregator end-to-end produce block LF-only (fixture temporanea)"
if (Test-Path $aggregatorPath) {
    $repoRoot = Split-Path -Parent $scriptDir
    $fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("ls-appendline-" + [guid]::NewGuid().ToString("N"))
    try {
        New-Item -ItemType Directory -Path (Join-Path $fixture "scripts") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $fixture "docs/state/sessions") -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $fixture "docs/state/stories") -Force | Out-Null
        Copy-Item -LiteralPath $aggregatorPath -Destination (Join-Path $fixture "scripts/aggregate-state.ps1")
        if (Test-Path $bundlePath) {
            Copy-Item -LiteralPath $bundlePath -Destination (Join-Path $fixture "scripts/generate-bundle.ps1")
        }
        foreach ($sub in @('sessions','stories')) {
            $src = Join-Path $repoRoot "docs/state/$sub"
            if (Test-Path $src) {
                Get-ChildItem -Path $src -Filter "*.md" | ForEach-Object {
                    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $fixture "docs/state/$sub/$($_.Name)")
                }
            }
        }
        foreach ($t in @('docs/SESSIONS.md','docs/11-BACKLOG.md','docs/INDEX.md','docs/BUNDLE.md','README.md')) {
            $src = Join-Path $repoRoot $t
            if (Test-Path $src) {
                $dst = Join-Path $fixture $t
                New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
                Copy-Item -LiteralPath $src -Destination $dst
            }
        }

        $psCmd = Get-Command pwsh -ErrorAction SilentlyContinue
        Push-Location $fixture
        try {
            if ($psCmd) {
                & pwsh (Join-Path $fixture "scripts/aggregate-state.ps1") 2>&1 | Out-Null
            } else {
                & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fixture "scripts/aggregate-state.ps1") 2>&1 | Out-Null
            }
        } finally {
            Pop-Location
        }

        $sessPath = Join-Path $fixture "docs/SESSIONS.md"
        if (Test-Path $sessPath) {
            $content = Get-Content $sessPath -Raw -Encoding UTF8
            $startMarker = "<!-- AGGREGATE-SESSIONS-START -->"
            $endMarker = "<!-- AGGREGATE-SESSIONS-END -->"
            $sIdx = $content.IndexOf($startMarker)
            $eIdx = $content.IndexOf($endMarker, $sIdx)
            if ($sIdx -lt 0 -or $eIdx -lt 0) {
                fail "S5" "marker del blocco AGGREGATE-SESSIONS non trovati nel fixture"
            } else {
                $block = $content.Substring($sIdx, $eIdx - $sIdx + $endMarker.Length)
                $crInBlock = ($block.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
                if ($crInBlock -eq 0) {
                    pass "SESSIONS.md block ha 0 CR dopo aggregator (LF only)"
                } else {
                    fail "S5" "SESSIONS.md block ha $crInBlock CR dopo aggregator"
                }
            }
        } else {
            fail "S5" "$sessPath non trovato"
        }
    } finally {
        Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    fail "S5" "$aggregatorPath non trovato"
}

Write-Host ""
Write-Host "=============================================="
Write-Host "Risultato: $PASS passati, $FAIL falliti su $TOTAL scenari"
Write-Host "=============================================="
if ($FAIL -gt 0) { exit 1 } else { exit 0 }
