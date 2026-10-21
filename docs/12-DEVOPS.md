# 12 — DevOps, Deployment & Security

> Status: 🟡 DRAFT · Versione 0.2 · Sessione 9 (audit 2026-10-15)
> Vincolante per: configurazione CI/CD, Docker, hosting, security headers

---

## 1. Principi DevOps

1. **Static-first**: Essendo un'app PWA local-first, il deployment è essenzialmente hosting statico. Niente backend complesso nel MVP.
2. **Riproducibilità**: Ogni build deve essere identica e verificabile tramite CI.
3. **Self-hosting friendly**: Fornire Docker out-of-the-box per gli utenti che vogliono ospitare l'app sul proprio NAS/server.
4. **Security by default**: Content Security Policy (CSP) strict, dipendenze aggiornate, nessun dato sensibile negli artifact.

---

## 2. CI/CD Pipeline (GitHub Actions)

La pipeline si attiva su ogni `push` a `main` e su ogni `pull_request`.

### 2.1 Workflow: `ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm run lint

      - name: Run type check
        run: pnpm run type-check

      - name: Run tests
        run: pnpm run test

      - name: Run coverage per package (vedi 10-TESTING §2)
        run: pnpm --filter @ls/core run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          fail_ci_if_error: true

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build PWA
        run: pnpm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: pwa-build
          path: apps/web/dist/
```

### 2.2 Regole di Merge
- Richiede almeno 1 review approvata (da `@amedeo82` o collaboratore).
- Tutti i check CI devono essere verdi (✅).
- Nessun file `fixtures/` può contenere pattern di email o IP reali (controllo tramite script pre-commit o CI).
- **Il job `bundle-check` deve passare** (vedi §9): se modifichi uno o più file del progetto inclusi nel bundle, devi aggiornare anche `scripts/generate-bundle.ps1` (se necessario) e rigenerare `docs/BUNDLE.md` nella stessa PR.

---

## 3. Containerizzazione (Self-Hosting)

Per gli utenti che desiderano ospitare Life Soundtrack sul proprio server (es. Raspberry Pi, NAS), forniamo un'immagine Docker leggera.

### 3.1 `Dockerfile` (Multi-stage)

```dockerfile
# Stage 1: Build (monorepo-aware)
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps apps
COPY packages packages
COPY scripts scripts
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ls/web run build

# Stage 2: Serve (Nginx)
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.2 `docker-compose.yml`

```yaml
version: '3.8'
services:
  life-soundtrack:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
    # Nessun volume necessario per l'app stessa, i dati restano nel browser dell'utente finale
    # Se si vuole persistere i log di nginx:
    # volumes:
    #   - ./nginx-logs:/var/log/nginx
```

---

## 4. Strategia di Deployment

### 4.1 Hosting Pubblico (Consigliato per MVP)
- **Piattaforma**: Vercel o Netlify.
- **Motivo**: Supporto nativo per PWA, HTTPS automatico, CDN globale gratuito, zero configurazione server.
- **Configurazione**:
  - Build command: `pnpm run build`
  - Output directory: `apps/web/dist`
  - Environment variables: Nessuna richiesta per il MVP (local-first).

### 4.2 Custom Domain
- Configurare il dominio (es. `life-soundtrack.app` o `lifetrack.audio`) con DNS pointing a Vercel/Netlify.
- Forzare HTTPS (HSTS abilitato di default dalle piattaforme).

---

## 5. Security & Headers

Anche se l'app è local-first, il server che la distribuisce deve essere sicuro.

### 5.1 Content Security Policy (CSP)
Da configurare in `nginx.conf` o nelle impostazioni di Vercel/Netlify (`vercel.json` o `_headers`):

```text
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'wasm-unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  connect-src 'self' https://api.musicbrainz.org https://*.musicbrainz.org; 
  worker-src 'self' blob:;
  frame-ancestors 'none';
```
*Nota*: `'wasm-unsafe-eval'` è necessario per Essentia.js (WebAssembly). `connect-src` limita le chiamate di rete solo a MusicBrainz (provider approvato per enrichment + bonus audio features su MBID). **Rimosso** `https://freqblog.com` (D.A.6: provider non più usato).

### 5.2 Altri Headers di Sicurezza
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(), camera=(), geolocation=()` (Disabilita accesso a hardware sensibile non necessario).

---

## 6. Monitoraggio & Errori

- **Nessun tracking utente**: Non installare Google Analytics, Mixpanel, Sentry o simili (D.A.1).
- **Error Reporting**: errori JS catturati da un error boundary locale e loggati nella **console del browser** dell'utente. L'utente può copiare e incollare il log su GitHub Issues. Nessun dato lascia il dispositivo.
- **Uptime**: Monitoraggio base tramite GitHub Actions o UptimeRobot sul dominio pubblico (se attivo in Fase 2).

---

## 7. Checklist Pre-Lancio

Prima di rendere il repository pubblico o il sito accessibile, verificare:

### Codice & Build
- [ ] `pnpm run lint`, `pnpm run type-check`, `pnpm run test` passano senza errori.
- [ ] Coverage test ≥ 80% per `packages/core`.
- [ ] Build PWA genera un `dist/` funzionante e service worker registrato.
- [ ] Nessun `console.log` con dati sensibili lasciato nel codice.

### Sicurezza & Privacy
- [ ] CSP configurata e testata (nessun blocco di risorse legittime).
- [ ] Tutti i security headers sono attivi (verificabili con securityheaders.com).
- [ ] I fixture di test (`fixtures/`) contengono SOLO dati sintetici.
- [ ] Privacy Policy e Disclaimer inferenze sono visibili e accessibili nell'app.

### Documentazione
- [ ] `README.md` ha istruzioni chiare per sviluppo e self-hosting.
- [ ] `AGENTS.md` è aggiornato e punta ai documenti corretti.
- [ ] Licenza del progetto definita e file `LICENSE` presente (**Apache-2.0**, D.A.10).

### UX & Accessibilità
- [ ] L'app è installabile come PWA su mobile e desktop.
- [ ] Navigazione da tastiera funzionante.
- [ ] Contrasti colori verificati (WCAG AA).
- [ ] `prefers-reduced-motion` rispettato.

---

## 8. Roadmap Post-Lancio (Fase 2+)

- [ ] Implementazione Sync Cloud E2E Encrypted (opzionale).
- [ ] Desktop App nativa tramite Tauri 2.0.
- [ ] Adapters per piattaforme aggiuntive (Deezer, Tidal, Qobuz).
- [ ] Supporto multilingua completo (aggiunta di ES, DE, FR).

---

## 9. Bundle script maintenance

`docs/BUNDLE.md` è uno snapshot di tutti i file del progetto (documentazione, spec, fixture) in un unico markdown, usato per handoff con AI esterne e prompt di re-attivazione. Lo script `scripts/generate-bundle.ps1` lo genera a partire da un array esplicito `$files`.

### 9.1 Comandi dello script

```powershell
pwsh scripts/generate-bundle.ps1           # genera docs/BUNDLE.md (default)
pwsh scripts/generate-bundle.ps1 -Check    # verifica che BUNDLE.md sia in sync; exit 0/1 (CI-friendly)
pwsh scripts/generate-bundle.ps1 -List     # stampa la lista dei file inclusi (audit)
pwsh scripts/generate-bundle.ps1 -Help     # help completo
```

> ⚠️ **PowerShell 5.1 + doppio trattino `--` (issue #104)**: usare sempre `-Check` /
> `-List` / `-Help` (singolo trattino), **MAI** `--check` / `--list`. In Windows
> PowerShell 5.1 il call operator `&` interpreta `--check` come fine-dei-parametri
> + token posizionale `check`: `[switch]$Check` non si lega e lo script ricadeva
> silenziosamente in modalità WRITING (riscrittura di `BUNDLE.md` + exit 0 = fail-open,
> vedi §9.7b). Lo script ora esce **2** con messaggio esplicito se vede un flag
> `--*`, ma è più semplice usare la sintassi corretta direttamente. Vale anche per
> `scripts/aggregate-state.ps1 -Check` (stesso guard applicato). In PowerShell 7
> (`pwsh`) `--check` viene normalizzato a `-Check` quindi non si vede il bug.

### 9.2 Quando aggiornare lo script

Aggiorna l'array `$files` in `scripts/generate-bundle.ps1` **nella stessa PR** in cui:

- Aggiungi un nuovo file in `docs/` (es. un nuovo ADR, un nuovo doc di sezione)
- Aggiungi un nuovo file in `fixtures/` (es. fixture per un nuovo adapter)
- Rinomini o sposti un file esistente che fa parte della specifica
- Aggiungi un nuovo file di root che vuoi includere (es. `CHANGELOG.md`, `CONTRIBUTING.md`)

### 9.3 Convenzioni di manutenzione

L'ordine dei file nell'array `$files` deve rispettare la struttura di `docs/INDEX.md`:

1. File di root (`AGENTS.md`, `README.md`, `LICENSE`)
2. Documenti di supporto (`docs/INDEX.md`, `docs/SESSIONS.md`, `docs/AUDIT-*.md`)
3. Documenti fondamentali in ordine di sezione (00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12)
4. ADR (`docs/13-ADR/*.md`) in ordine numerico
5. Resto documenti fondamentali (14, 15)
6. Fixture (`fixtures/synthetic-history/*.json`)

Non includere mai `docs/BUNDLE.md` stesso (si auto-includerebbe).

### 9.4 Verifica automatica in CI

Aggiungere il job `bundle-check` al workflow `ci.yml`:

```yaml
  bundle-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify BUNDLE.md is in sync
        shell: pwsh
run: pwsh scripts/generate-bundle.ps1 -Check
```

Se il check fallisce, il messaggio indica esattamente cosa è cambiato:
- `[OK] docs/BUNDLE.md e in sync con la lista corrente (N file).` (exit 0)
- `[FAIL] Da aggiungere al bundle: <file>` (file nuovo non ancora in `$files`)
- `[FAIL] Da rimuovere dal bundle: <file>` (file rimosso/rinominato)
- `[FAIL] Lista file identica, ma contenuto cambiato` (modifica a un file doc, rigenera)

### 9.5 Workflow di manutenzione (sviluppatore)

```
1. Modifica un file in docs/ o fixtures/
2. (se hai aggiunto/rimosso file) modifica $files in scripts/generate-bundle.ps1
3. Esegui: pwsh scripts/generate-bundle.ps1
4. (opzionale) verifica: pwsh scripts/generate-bundle.ps1 -Check
5. Committa docs/, fixtures/ e scripts/generate-bundle.ps1 + docs/BUNDLE.md nella stessa PR
```

### 9.6 Test locale

```powershell
# Stato corrente
pwsh scripts/generate-bundle.ps1 -List

# Rigenera
pwsh scripts/generate-bundle.ps1

# Verifica sync (CI parity)
pwsh scripts/generate-bundle.ps1 -Check
```

### 9.7 Determinismo del `-Check`

Il confronto `-Check` normalizza sia la riga `> Data:` (timestamp) sia i line endings (`CRLF` → `LF`) sia nel file su disco che nel bundle rigenerato, prima del confronto. Questo rende il check deterministico: non fallisce per solo cambio di timestamp o per differenza di line endings tra Windows e Linux/CI.

Il check continua a rilevare drift reali (file aggiunti/rimossi, contenuto modificato).

### 9.7b Fail-closed sui flag sconosciuti (issue #104)

In aggiunta al determinismo, lo script è **fail-closed** sui flag sconosciuti. In
Windows PowerShell 5.1, con `& script.ps1 --check`, il call operator interpreta
`--check` come fine-dei-parametri + token posizionale `check`: `[switch]$Check`
non si lega e lo script ricadeva **silenziosamente** in modalità WRITING (riscrittura
di `BUNDLE.md` + exit 0 = fail-open). Un agente che credeva di star verificando
la sincronizzazione in realtà la stava creando (vedi lesson 40-1 e 41-1 in
`docs/SESSIONS.md`).

Il guard in cima allo script rileva qualsiasi `--*` (o `-*`) passato non legato
a uno switch noto e:

- esce con codice **2** (errore di parametro, distinto da drift = 1),
- scrive un messaggio esplicito che mostra la forma ERRATO (`--check`) e quella
  CORRETTO (`-Check`).

Lo stesso guard è applicato a `scripts/aggregate-state.ps1 -Check`: un fail-silently
lì è ancora peggio (l'aggregator scrive 4 file globali, drift invisibile su
`main`). Test di regressione in `scripts/test-bundle-check-idempotent.sh` (5+1 scenari
bash su repo temporanei, gate bloccante in CI via `.github/workflows/ci.yml`).

### 9.8 Semantica come gate CI

Il flag `-Check` ha **semantica di fail-fast gate CI** (decisione cristallizzata in S32, issue #41 — formalizzazione dell'opzione A di `gh issue #10` chiusa in S17):

| Esito del check | Exit code | Significato | Comportamento CI |
|-----------------|-----------|-------------|------------------|
| BUNDLE.md in sync con `$files` + contenuto identico | **0** | OK | Job `bundle-check` ✅ → merge abilitato |
| File dichiarati in `$files` non esistono su disco | **2** | Drift strutturale | CI rosso (marker `[FAIL] N file dichiarati non esistono`) |
| BUNDLE.md assente | **1** | Prima esecuzione | CI rosso (marker `[FAIL] docs/BUNDLE.md non esiste`) |
| BUNDLE.md presente ma disallineato (contenuto, file list) | **1** | Drift di contenuto | CI rosso con dettaglio file aggiunti/rimossi |

**Garanzie semantiche** (vincolanti per gli agenti):

1. **Determinismo cross-platform**: il check passa identico su Windows (CRLF) e Linux/macOS (LF). La normalizzazione `CRLF → LF` è obbligatoria prima del `Compare-Object`.
2. **Determinismo cross-tempo**: il check passa anche se lanciato a minuti/ore diverse dall'ultima rigenerazione, purché il contenuto sia semanticamente identico. La riga `> Data: ...` viene normalizzata a `> Data: 0000-00-00 00:00` prima del confronto.
3. **Zero falsi positivi**: il check non fallisce MAI per sola differenza di timestamp o line endings.
4. **Rilevamento drift reale**: ogni drift di `$files` (aggiunta/rimozione di file in scope) o di contenuto (modifica a un file incluso) viene rilevato con messaggio esplicito ("Da aggiungere al bundle: …", "Da rimuovere dal bundle: …", "Lista file identica, ma contenuto cambiato").
5. **Fail-fast**: `--check` NON modifica mai `BUNDLE.md`; per la rigenerazione serve il flag di default (senza `--check`).

**Integrazione CI** (`.github/workflows/ci.yml`):

```yaml
- name: Bundle in sync
  run: pwsh scripts/generate-bundle.ps1 --check
```

Il job `bundle-check` è un **CI gate bloccante**: PR con BUNDLE.md non in sync non possono essere mergate finché l'agente non rigenera il bundle nella stessa PR (o, in emergenza, con `--no-verify` documentando la ragione).

**Procedura di recovery** (per l'agente che vede il CI rosso):

```powershell
# 1. Rigenera localmente
pwsh scripts/generate-bundle.ps1

# 2. Verifica sync (singolo trattino, vedi §9.7b)
pwsh scripts/generate-bundle.ps1 -Check     # deve uscire 0

# 3. Committa nella stessa PR
git add docs/BUNDLE.md scripts/generate-bundle.ps1
git commit -m "chore(bundle): rigenera BUNDLE.md post-modifiche docs"
git push
```

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 8 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: rimosso Sentry da §6 (D.A.1, errori loggati localmente); CSP ripulita, rimosso `https://freqblog.com` (D.A.6); Dockerfile riscritto monorepo-aware con `pnpm-workspace.yaml`; CI copertura per-package (`@ls/core`); riferimento licenza aggiornato ad Apache-2.0 (D.A.10); **nuovo §9 "Bundle script maintenance"** con comandi, convenzioni, CI check, workflow dev (post-review del bundle) |
