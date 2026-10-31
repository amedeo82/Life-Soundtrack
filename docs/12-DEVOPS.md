# 12 — DevOps, Deployment & Security

> Status: 🟡 DRAFT · Versione 1.4 · Sessione 72 (2026-10-31) · baseline PowerShell 7 (`pwsh`) + confine di encoding dei `.ps1`
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

> **⚠️ Lo YAML sotto è uno scheletro di progetto, non lo stato corrente.** Il
> workflow reale oggi è un **job singolo** `quality` su `ubuntu-latest`, con
> `pnpm install --frozen-lockfile` e i gate elencati in [§9.10](#910-gate-reali-di-ciyml);
> non esistono né il job `build` né `codecov/codecov-action` né
> `actions/upload-artifact`. L'elenco autorevole dei gate è §9.10 — è stato
> verificato riga per riga contro `.github/workflows/ci.yml` in Sessione 44
> (issue #135, acceptance criterion "i gate elencati corrispondono a quelli
> effettivamente in `ci.yml`").

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
  connect-src 'self' https://api.musicbrainz.org https://*.musicbrainz.org https://acousticbrainz.org https://audio-ssl.itunes.apple.com https://itunes.apple.com https://download.db-ip.com; 
  worker-src 'self' blob:;
  frame-ancestors 'none';
```
*Nota*: `'wasm-unsafe-eval'` è necessario per Essentia.js (WebAssembly). `connect-src` limita le chiamate di rete ai **provider approvati**: MusicBrainz (enrichment + bonus audio features su MBID) e, dal Sessione 62, i **tre** host delle audio features (D-AF.9). **Rimosso** `https://freqblog.com` (D.A.6: provider non più usato).

**Aggiornamento (Sessione 62, spec `21-AUDIO-FEATURES.md` v1.0 🟢 APPROVED)**: la pipeline delle audio features ha due host in più, entrambi dichiarati nella spec (D-AF.9): `https://acousticbrainz.org` per il bonus sui MBID e `https://audio-ssl.itunes.apple.com` per il **download dell'anteprima audio di 30 s**, che viene analizzata in locale e non esce dal dispositivo. Sono gli unici due host aggiunti: nessun altro servizio entra in `connect-src`.

**Aggiornamento (Sessione 66, spec `21-AUDIO-FEATURES.md` v1.1 🟢 APPROVED, issue #196)**: `connect-src` ammette anche `https://itunes.apple.com`, l'host che **risponde** alla ricerca del preview (`GET https://itunes.apple.com/search`). La v1.0 della spec elencava i due host che **non** sono quello della ricerca: la CSP bloccava la richiesta e la pipeline degradava sempre ad AcousticBrainz/euristico (Essentia mai chiamabile, `valence`/`energy` mai misurate). Il project owner ha **ratificato il terzo host** (D-AF.9 emendata): i **tre** host sono gli unici aggiunti, nessun altro servizio entra in `connect-src`. Il codice applicato al bundle (`apps/web/src/security/`) includeva già l'host della ricerca dal merge della Story 4.1: questa è l'allineamento della **dichiarazione** al codice.
**Nota (Sessione 67, `13-ADR/0009-local-ip-geolocation.md` v1.0 🟢 APPROVED, D-B.2)**: il download on-demand del database geo introduce **un host nuovo**, dichiarato in `connect-src` nella Story 4.4: `https://download.db-ip.com`. L'host è servito da un'origine dichiarata in `connect-src` e il file scaricato non entra in `script-src` (non è eseguito). La regola è quella imparata con la issue #196: la CSP applicata e la spec devono dire la stessa cosa; un host usato dal codice e non dichiarato è una richiesta bloccata.

### 5.2 Altri Headers di Sicurezza
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(), camera=(), geolocation=()` (Disabilita accesso a hardware sensibile non necessario).
### 5.3 Licenza e offerta del sorgente (AGPL-3.0)

Il repository è sotto **AGPL-3.0** (`LICENSE`), non Apache-2.0: `essentia.js` è AGPL-3.0 e la PWA distribuisce il modulo acustico agli utenti (D-AF.2, `21-AUDIO-FEATURES.md` §2.4; ratificata dal project owner il 2026-10-30, issue #201).

L'obbligo operativo è il **§13** della licenza: chi modifica l'app e la mette a disposizione su una rete deve offrire a tutti gli utenti che interagiscono con essa **l'opportunità di ricevere il Corresponding Source** della propria versione. Per un progetto open-source puro l'offerta è il repository pubblico, ma **deve essere dichiarata in-product**: è il requisito dell'issue **#202**, non ancora implementato.

Deliverable della story che lo implementa: un NOTICE con le attribuzioni delle terze parti distribuite (Essentia.js AGPL-3.0; DB-IP Lite CC BY 4.0 quando la Story 4.4 lo introduce) e un riferimento alla licenza nelle schermate di about e nelle Impostazioni.

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

> **Baseline PowerShell 7 (`pwsh`)** *(Sessione 71)*: gli script in `scripts/*.ps1` si invocano
> con `pwsh`, non con `powershell` (Windows PowerShell 5.1). In `pwsh` il doppio trattino viene
> normalizzato sul singolo **prima** del binding, quindi `--check` e `-Check` sono equivalenti:
> il bug dell'issue #104 (fail-open: `--check` ricadeva in modalità WRITING) è **proprio di
> 5.1** e non si reproduce con il baseline corrente. La forma **canonica** resta comunque quella
> a **singolo trattino** (`-Check` / `-List` / `-Help`): è l'unica che si comporta allo stesso
> modo su 5.1 e 7, ed è quella che il guard fail-closed indica come corretta. Se un gate riceve
> un flag che non riconosce esce **2** (errore di parametro), **non** 1 (drift) — vedi §9.7b.

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

**Stato al baseline PowerShell 7** *(Sessione 71)*: il guard resta in piedi, ma
nello scenario che l'ha motivato non scatta più. `pwsh` normalizza `--check` su
`-check` **prima** del binding dei parametri, quindi `[switch]$Check` si lega e il
flag non finisce né in `$args` né in `$MyInvocation.UnboundArguments`: il guard
non vede nulla e lo script esegue il check richiesto (exit 0 se in sync). Il
guard rimane utile per due casi reali: un **flag davvero inesistente** (`-Chek`,
`--dryrun` senza il nome giusto) e l'invocazione da una shell **5.1**, dove il
doppio trattino non viene normalizzato. Verificato su pwsh 7.6.9: `-Check` e
`--check` danno lo stesso risultato e lo stesso exit code.

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
5. **Fail-fast**: `-Check` NON modifica mai `BUNDLE.md`; per la rigenerazione serve il flag di default (senza `-Check`).

**Integrazione CI** (`.github/workflows/ci.yml`):

```yaml
- name: Bundle in sync
  run: pwsh scripts/generate-bundle.ps1 -Check
```

Il job `bundle-check` è un **CI gate bloccante**: PR con BUNDLE.md non in sync non possono essere mergate finché l'agente non rigenera il bundle nella stessa PR (o, in emergenza, con `--no-verify` documentando la ragione).

**Workflow automatico post-merge** (introdotto da issue #115, follow-up di PR #113): il workflow `.github/workflows/auto-bundle.yml` rigenera automaticamente `docs/BUNDLE.md` dopo ogni push a `main` che tocca `$files` o il bundle script stesso. Companion di `auto-state-aggregate.yml` (che gestisce i blocchi `<!-- AGGREGATE-* -->`); entrambi condividono il concurrency group `post-merge-main` con `cancel-in-progress: false` per serializzare le due rigenerazioni ed evitare race sul push di `BUNDLE.md`. Idempotente via guard `git diff --quiet docs/BUNDLE.md`.

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

### 9.8b `auto-bundle.yml` (issue #115)

Issue #115 e' un follow-up del drift BUNDLE.md che si e' verificato su `origin/main` dopo il merge di PR #112 (issue #105): PR #111 (issue #104) aveva aggiunto `scripts/test-bundle-check-idempotent.sh` al `$files` + rigenerato `BUNDLE.md` nella stessa PR (64 file), ma il workflow `auto-state-aggregate` post-merge aggiorna SOLO il blocco `<!-- AGGREGATE-BUNDLE-INVENTORY -->` in cima a `BUNDLE.md`, NON le sezioni `===== FILE: ... =====` che leggono l'array `$files`. Il rebase di PR #112 (issue #105) ha ereditato una versione di `BUNDLE.md` pre-rebase con 63 markers e `-Check` su main e' uscito 1.

`auto-bundle.yml` chiude la classe di bug definitivamente:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'scripts/generate-bundle.ps1'
      - 'AGENTS.md'  - 'README.md'  - 'LICENSE'
      - 'docs/**'  - 'scripts/**'  - '.githooks/**'
      - '.github/**'  - 'fixtures/**'
concurrency:
  group: post-merge-main   # serializza con auto-state-aggregate.yml
  cancel-in-progress: false
```

**Caratteristiche**:

- Trigger: solo quando `$files` cambia (o un file coperto da esso). Push che tocca solo `apps/`, `packages/` ecc. NON fanno scattare il workflow.
- Idempotente: `git diff --quiet docs/BUNDLE.md` skippa il commit se la rigenerazione non produce un diff reale.
- Self-healing: chiude il drift anche se l'agente dimentica di rigenerare `BUNDLE.md` nella PR.
- Compagna auto-state-aggregate: le due workflow partono entrambe sui push a main con paths `docs/**`, si serializzano via concurrency group ed evitano race sul push di `BUNDLE.md`.

**Lezione operativa D.116.1**: durante un rebase con conflitti su `BUNDLE.md`, NON prendere `theirs/ours` ciecamente. Rigenerare SEMPRE `BUNDLE.md` con `pwsh scripts/generate-bundle.ps1` dopo il rebase (lo script riflette lo stato aggiornato di `$files` post-rebase).

### 9.8c Copertura `git add` vs `$targets` (issue #136)

Lo stesso pattern di ADR-0008 — *un dato con due fonti di verità, tenute in due posti diversi, senza un gate che le confronti* — si è manifestato **sugli strumenti** invece che sui documenti, e con un esito peggiore: il dato non era duplicato, era **scartato**.

`scripts/aggregate-state.ps1` dichiara i file che gestisce in un array `$targets` (oggi 6 blocchi su 5 file):

| # | File | Blocco | Introdotto da |
|---|------|--------|----------------|
| 1 | `docs/SESSIONS.md` | `<!-- AGGREGATE-SESSIONS-{START,END} -->` | ADR-0008 V1 (S25) |
| 2 | `docs/11-BACKLOG.md` | `<!-- AGGREGATE-STORIES-{START,END} -->` | ADR-0008 V1 (S25) |
| 3 | `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-STATUS-{START,END} -->` | ADR-0008 V2 (S29) |
| 4 | `docs/INDEX.md` | `<!-- AGGREGATE-INDEX-ROADMAP-{START,END} -->` | ADR-0008 V2 (S29) |
| 5 | `docs/BUNDLE.md` | `<!-- AGGREGATE-BUNDLE-INVENTORY-{START,END} -->` | ADR-0008 V2 (S29) |
| 6 | `README.md` | `<!-- AGGREGATE-NEXT-STEP-{START,END} -->` | ADR-0008 V3 (S42, issue #127) |

`.github/workflows/auto-state-aggregate.yml` deve **committare** tutti quei file, ma li elencava a mano in un secondo elenco:

```yaml
git add docs/SESSIONS.md docs/11-BACKLOG.md docs/INDEX.md docs/BUNDLE.md scripts/aggregate-state.ps1 docs/state/
```

Quando #127 ha aggiunto `README.md` come quinto target, il workflow ha continuato a **generare** il blocco NEXT-STEP (lo step "Apply aggregator" scrive su tutti i `$targets`) e a **scartarlo** (il blocco restava dirty nel working tree del runner, fuori dallo staging). Nessun errore, nessun warning: il commit riusciva con 4 file invece di 5.

**Perché è rimasto invisibile**: il blocco era rimasto coerente **per caso**. Finché l'unica story non-`done` non esisteva, il fallback generato (`_Nessuna story non-done migrata..._`) coincideva byte per byte con il testo già presente in `README.md`, quindi `aggregate-state.ps1 -Check` usciva 0 e il bug non aveva un sintomo osservabile. Il drift è emerso solo alla prima story `todo` (1.2, creata in S42): `-Check` è passato da 0 a 1 su `README.md` (`Atteso: 542 chars, Trovato: 393 chars`) senza che nessuno avesse toccato né il workflow né il README.

**Il fix** è di una parola nella riga `git add` (`README.md` inserito nell'ordine di precedenza del generatore, dopo `docs/BUNDLE.md`).

**La difesa strutturale** è in `scripts/validate-workflows.mjs`, che già è un gate bloccante in CI (issue #73): ora confronta i due elenchi e fallisce elencando i `$targets` non coperti dalla riga `git add`. La copertura accetta sia il path letterale sia una directory che lo contiene (`docs/state/`, `.`), così l'elenco può restare leggibile senza perdere la copertura. Il test di regressione è `scripts/test-workflow-git-add-coverage.sh` (T1..T4): verifica che il gate **esca 1** quando si reintroduce il bug — un gate che passa sempre non è un gate.

```powershell
node scripts/validate-workflows.mjs .github/workflows   # include la copertura `git add`
bash scripts/test-workflow-git-add-coverage.sh          # scenario negativo (gate bloccante in CI)
```

**Regola generale**: quando si aggiunge un target a un generatore, va aggiornata **nello stesso commit** ogni lista che lo consuma a mano (elenco di staging del workflow, `$files` del bundle, tabelle documentali), e va aggiunto un gate che confronti le due liste. L'alternativa debole `git add -A` elimina la classe di bug ma rende il commit del bot non prevedibile (aggreggerebbe file non correlati): preferita la lista esplicita + il gate.

**Nota di mascheratura**: dal 2026-10-21T16:21Z al 2026-10-22 `ci.yml` non eseguiva più alcun job (issue #135, `metadata: read` — scope non dichiarabile — nel blocco `permissions:`), quindi questo gate non stava girando in CI. La verifica era stata fatta in locale; **#135 è risolto in Sessione 44** e la copertura automatica è tornata attiva. Vedi §9.9.

---

### 9.8d Sync con `origin/main` dei writer di `main` (issue #140)

`auto-bundle.yml` (§9.8b) e `auto-state-aggregate.yml` sono i **due workflow che pushano su `main`**. Condividono il concurrency group `post-merge-main` con `cancel-in-progress: false`, pensato per serializzarli. La serializzazione, però, **non basta**.

**Il bug**: il concurrency group serializza i *run*, non i *checkout*. `actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del merge commit che ha fatto scattare la run — non sulla testa corrente di `main`. Sul push di un merge entrambe le workflow scattano; quando la seconda parte dopo che la prima ha pushato:

| t | `auto-bundle` | `auto-state-aggregate` |
|---|---------------|------------------------|
| t0 | parte, checkout di `5e2d602` | in coda (concurrency group) |
| t1 | sync col tip, rigenera, **pusha** → `6287490` | — |
| t2 | — | parte, checkout di **`5e2d602`** (stesso `github.sha`) |
| t3 | — | rigenera, committa, `git push origin main` |
| t4 | — | **`! [rejected] main -> main (non-fast-forward)`** |

`auto-bundle.yml` sopravvive perché ha uno step «Sync con origin/main» (`git fetch origin main` + `git rebase origin/main`, con fallback `git reset --hard`): si riallinea al tip prima di generare. `auto-state-aggregate.yml` **non lo aveva**, ed è per definizione l'unico dei due che può trovarsi secondo.

**Il fix** è lo step «Sync con origin/main» in `auto-state-aggregate.yml`, identico a quello del companion. `ref: main` sul checkout sarebbe un'alternativa valida ma si regge sull'assunzione che il primo writer a partire sia quello senza sync: il sync è idempotente e non dipende dall'ordine di scheduling.

**Perché è una classe di fallimento silenzioso**: il merge è riuscito e `ci.yml` è verde, ma i blocchi aggregati sono **indietro**. Nessun gate confronta i blocchi aggregati con lo stato reale dei merge — `aggregate-state.ps1 -Check` gira sul checkout della PR, e il workflow che dovrebbe riallineare `main` è quello che fallisce. Caso concreto: il doc-sync della Story 1.2 (PR #139, merge `2e1a4cc`) non è mai arrivato su `main`, e `README.md` ha continuato ad annunciare la 1.2 come «prossima story» dopo il merge.

**La difesa strutturale** è in `scripts/validate-workflows.mjs`, già gate bloccante in CI dal #73: ogni workflow che contiene `git push origin main` deve dichiarare una sincronizzazione verso `origin/main` **prima** del push. L'ordine fa parte del contratto — uno step di sync dichiarato dopo il push è sintatticamente presente e praticamente inerte, cioè la variante «sembra a posto» della stessa classe di bug. Sono accettate tre forme equivalenti (`git rebase origin/main`, `git reset --hard origin/main`, `git pull [--rebase] origin main`). Il gate **non** tassa i workflow che pushano su un branch: sono writer di branch, non di `main`, e tassarli produrrebbe falsi positivi su workflow legittimi.

Il test di regressione è `scripts/test-workflow-push-sync.sh` (T1..T5, 15 assert): T2 rimuove lo step di sync da `auto-state-aggregate.yml` e verifica che il gate **esca 1** (un gate che passa sempre non è un gate, lesson 43-1), T3 verifica che una forma di sync alternativa non venga tassata, T4 che un push su branch non venga tassato, T5 che un sync **dopo** il push venga tassato.

```powershell
node scripts/validate-workflows.mjs .github/workflows   # include il gate di sync dei writer di main
bash scripts/test-workflow-push-sync.sh                 # scenario negativo (gate bloccante in CI)
```

**Regola generale**: quando due workflow scrivono sullo stesso ref servono **due** proprietà distinte — chi pusha per primo (concurrency group) e **su quale commit** si pusha (sync). La prima senza la seconda produce `non-fast-forward` con la stessa firma di un conflitto di merge reale. In generale, ogni workflow che esegue `git push` verso un ref che altri workflow aggiornano deve allinearsi a quel ref prima di generare e prima del push.

---

### 9.8e Ordinamento fra i due writer di `main` (issue #149)

Il concurrency group `post-merge-main` (§9.8d) **serializza** i due writer di `main`, ma **non ne impone l'ordine**: quale workflow ottenga prima il lock non è deterministico. Finora l'ordine non importava, perché i due writer producevano contenuti indipendenti. Con `auto-bundle.yml` (issue #115) l'importa: **`auto-bundle` copia il contenuto dei file che `auto-state-aggregate` modifica**.

**Il bug (caso reale: merge della PR #147, 2026-10-26T12:50Z)**:

```
12:50:12  merge PR #147 → push su main
12:50:23  auto-bundle           → rigenera, ma i blocchi sorgente sono ANCORA VECCHI
                                  → "BUNDLE.md gia' in sync: nessun commit necessario"
12:50:55  auto-state-aggregate  → committa i blocchi aggregati freschi
                                  → la copia dentro BUNDLE.md resta vecchia  ✗
```

Il drift era di **6 righe** in `docs/BUNDLE.md` (riga Story 1.3 con `#null`/`null`, stato della Sessione 47 «non ancora mergiata», conteggio `merge: 18` → `19`) ed era **silenzioso**: il gate CI sul bundle è warning-only, la pipeline restava verde, e lo stato dichiarato divergeva da quello reale.

**Perché non si auto-correggeva**: il commit del bot `36aeb29` aveva toccato `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md`, `README.md` — tutti nei trigger path di `auto-bundle` (`docs/**`, `README.md`). La run **non partiva**, perché il push avviene con `secrets.GITHUB_TOKEN` e GitHub **sopprime i workflow run innescati dal proprio GITHUB_TOKEN** (misura anti-ricorsione; le sole eccezioni documentate sono `workflow_dispatch` e `repository_dispatch`).

**Il fix (opzione A, decisa dal Boss)**: `auto-bundle.yml` dichiara un secondo trigger

```yaml
workflow_run:
  workflows: ["auto-state-aggregate"]
  types: [completed]
```

`workflow_run` è agganciato alla **conclusione** del workflow, non a un push: sopravvive alla soppressione del GITHUB_TOKEN ed è il workaround documentato per i workflow che si innescano a vicenda. Con questo trigger `auto-bundle` gira **sempre** una seconda volta dopo che `auto-state-aggregate` ha committato i blocchi: la copia embedded è allora allineata ai sorgente, **indipendentemente dall'ordine di scheduling**.

Il trigger `push` resta: da solo copre i merge che toccano i path di `$files` senza toccare `docs/state/**` (in quel caso `auto-state-aggregate` non parte e il bundle deve comunque rigenerarsi).

**Gate** (`scripts/validate-workflows.mjs`, bloccante in CI): verifica che `auto-bundle.yml` dichiari un trigger `workflow_run` su `auto-state-aggregate` **e** che il nome in `workflows:` combaci con il `name:` reale del producer — una disallineazione non dà errore, il trigger semplicemente non scatterebbe mai, in silenzio. Test di scenario negativo: `scripts/test-workflow-writer-ordering.sh` (T1..T5, 6 assert).

```powershell
node scripts/validate-workflows.mjs .github/workflows   # include il gate di ordinamento
bash scripts/test-workflow-writer-ordering.sh           # scenario negativo (gate bloccante in CI)
```

**Regola generale**: quando due workflow concorrono allo **stesso artefatto logico** — non solo allo stesso ref — la serializzazione non basta: serve che il secondo consumi l'output del primo *dopo* che il primo l'ha prodotto. Il concurrency group ordina i *run*, non gli *effetti*. Se il secondo workflow **legge** ciò che il primo **scrive**, il trigger corretto è `workflow_run` (agganciato alla conclusione), non `push` (agganciato all'evento, e soppresso quando l'evento nasce da un GITHUB_TOKEN).

---

### 9.8g Selezione del NEXT-STEP: solo story lavorabili (issue #182)

Il blocco `<!-- AGGREGATE-NEXT-STEP-* -->` del README indica **la prossima story da
implementare**. Fino alla Sessione 59 filtrava solo `done`: una story in stato
`blocked` (STOP: bloccata da una dipendenza esterna) o `wontdo` (NO: scope
cancellato) finiva **in cima** alla lista, e il lettore del repository trovava un
puntatore a qualcosa che non si poteva lavorare.

Il caso reale: la Story 2.1 (Mood Tracker) è bloccata dalle **audio features**
dell'EPIC 4.1, che non sono implementate (decisione D-A.1 della Sessione 59), e
il blocco la indicava come "prossima story" mentre la story implementabile era la
**2.4** (Memory Engine, issue #179).

La regola ora applicata da `scripts/aggregate-state.ps1` (`Build-Block-NextStep`):

| `status` | Nel NEXT-STEP | Perché |
|---|---|---|
| `todo` (TODO) | ✅ | la candidata |
| `in_progress` (IN PROGRESS) | ✅ | in lavorazione, non bloccata |
| `in_review` (IN REVIEW) | ✅ | PR aperta, in lavorazione |
| `done` (DONE) | ❌ | completata |
| `blocked` (STOP) | ❌ | dipende da una dipendenza esterna |
| `wontdo` (NO) | ❌ | scope cancellato |

Il messaggio di fallback e la riga delle altre candidate dicono ora "non-done **e non
bloccate**". I due sub-test nuovi in `scripts/test-aggregate-determinism.sh`
(**T10e**, **T10f**) coprono il salto della story bloccata e il fallback con
sole story bloccate: **falliscono senza il fix** (lesson 43-1 — un gate che passa
sempre non è un gate).

### 9.8f Gate "fatti del README" (issue #161)

Un gate che confronta **la prosa** con **il codice**. Il README è la prima cosa che legge chi arriva nel repository: se dichiara piattaforme e funzionalità che non esistono, il danno non è estetico — è una promessa falsa all'utente.

**Il drift chiuso dall'issue #161** (rilevato il 2026-10-27, Sessione 54):

| Cosa il README dichiarava | Cosa il codice diceva |
|---|---|
| 8 piattaforme importabili (Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz) | 5 piattaforme in `ACTIVE_PLATFORMS`: Deezer, Tidal e SoundCloud non hanno né factory né classe adapter |
| "Arricchisce i dati con audio features (valence, energy, danceability, BPM)" | nessun adapter di enrichment: capability dell'EPIC 4 |
| "timeline emotiva … analisi, mood, ricordi" | nessuna analisi implementata: capability dell'EPIC 2 |
| `EPIC 0 — Fundamentals: 7/7` in prosa | conteggio duplicato: la fonte è il blocco aggregato di `docs/INDEX.md` |

La prosa era rimasta quella del bootstrap (`ebdab9d`, 2026-10-14) perché i merge delle Story 1.2 (`2e1a4cc`) e 1.3 (`7afbf03`) non avevano toccato il README e **nessuno dei 16 gate di `ci.yml` confrontava la prosa con il codice**. Pipeline verde, README falso: il fallimento silenzioso.

**La causa radice è di ownership, non di tooling.** `README.md` è un file **ibrido**: il blocco `<!-- AGGREGATE-NEXT-STEP-* -->` è generato da `scripts/aggregate-state.ps1`, tutto il resto è prosa scritta a mano. La regola di ownership dei file globali (D.38.1) copriva i file aggregati, non il README: nessuna tabella dichiarava chi scrive cosa, quindi nessuno se ne sentiva responsabile. La regola nuova è in `AGENTS.md` §"Ownership del `README.md`" (D.161.1).

**Il gate** (`scripts/check-readme-facts.mjs`) è **read-only**:

| Controllo | Fonte di verità |
|---|---|
| Le piattaforme dichiarate = le piattaforme attive | `ACTIVE_PLATFORMS` in `apps/web/src/onboarding/OnboardingRouter.tsx` |
| Ogni piattaforma attiva ha una factory adapter | `ADAPTER_FACTORIES` (stesso file) |
| Ogni factory punta a una classe che esiste | `packages/core/src/adapters/` |
| Nessuna capability non implementata dichiarata come presente | elenco delle capability EPIC 2 / EPIC 4 |
| Nessun conteggio duplicato in prosa | i blocchi aggregati di `docs/INDEX.md` / `docs/11-BACKLOG.md` |

Exit code: 0 = in sync, 1 = drift, 2 = errore di ambiente (fail-closed: un file sorgente mancante blocca, non lascia passare).

**Perché non ha una modalità di scrittura**: `README.md` è già un target di `scripts/aggregate-state.ps1`. Un secondo writer sullo stesso file riprodurrebbe la race fra i writer di `main` risolta dall'issue #149 (bundle e aggregato che si sovrascrivono a vicenda). Il gate **verifica**, non **genera**: l'unico scrittore resta l'agente, e il gate dice se ha sbagliato.

```bash
node scripts/check-readme-facts.mjs     # verifica
bash scripts/test-readme-facts-gate.sh  # scenario negativo (T1..T9)
```

Il test (`scripts/test-readme-facts-gate.sh`) copre i 9 casi in cui il gate deve uscire **1** o **2**: piattaforma inesistente, piattaforma mancante, factory senza adapter, classe inesistente, capability fuori roadmap, capability dentro la roadmap (nessun falso positivo), conteggio duplicato, README mancante. Un gate che passa sempre non è un gate (lesson 43-1).

**Regola generale**: una prosa che dichiara fatti verificabili dal codice è **codice**, e va verificata da un gate come il resto. Il README non è un documento di opinione: "8 piattaforme" è un'affermazione falsificabile, e il costo di non verificarla è la perdita di fiducia di chi arriva nel repository per la prima volta.

---

### 9.9 Scope `permissions:` valide (issue #135)

Un errore che **non produce un job che fallisce** produce un workflow che GitHub *rifiuta in fase di validazione*. Dal 2026-10-21T16:21Z al 2026-10-22 `ci.yml` ha avuto esattamente questa firma.

**Il bug**: `ci.yml` dichiarava `metadata: read` nel blocco `permissions:` del job `quality` (commit `43d982d`, issue #120). `metadata` **non è una scope dichiarabile** della `GITHUB_TOKEN`: è sempre concessa implicitamente e non è fra le scope documentate in "Workflow syntax for GitHub Actions" → `permissions`. GitHub risponde `Unexpected value 'metadata'` e scarta l'intero file.

**La firma del fallimento**, che non assomiglia a nessun'altra:

| Segnale | Valore |
|---------|--------|
| `GET /actions/runs/{id}` | `conclusion: failure`, `status: completed` |
| `run_started_at` | identico a `created_at` → **0 secondi** |
| `GET /actions/runs/{id}/jobs` | `total_count: 0` |
| check-suite | esiste e finisce `completed`/`failure`, con **0 check-run** |
| log / annotazioni | **nessuna**: non esiste un check-run a cui attaccarle |
| `GET /actions/workflows/ci.yml` | `state: active` (la registrazione del workflow è valida) |
| `gh run view` | *"This run likely failed because of a workflow file issue"* |

**Perché nessun controllo esistente lo intercettava**:

- **Nessun parser YAML lo vede.** `js-yaml`, `actionlint` incluso, accettano `metadata: read` senza errori: la chiave è sintatticamente lecita. È la *schema* GitHub a rifiutarla, non la sintassi.
- **Le API dicono che va tutto bene.** Il workflow risulta `active`, la check-suite esiste e si chiude `completed`. Nessun endpoint segnala l'errore di validazione.
- **La signature è ambigua.** Run creata → 0 job → fallimento immediato è anche la firma di "Actions bloccata per billing" o per quota esaurita. L'ipotesi della quota (repo privato, account GitHub Free) si reggeva su un dato reale ma era **falsa**: negli stessi minuti, sugli stessi runner e sullo stesso account, gli altri 5 workflow del repo andavano verdi (`auto-bundle` 43s, `auto-state-aggregate` 25s, `auto-status-done` 10s). Una quota esaurita o un blocco di billing fermerebbero **tutti** i workflow, non uno.

**Diagnosi risolutiva** (tabella `jobs` × `conclusion` dei 60 run di `ci.yml`):

| Run | Timestamp | `conclusion` | `jobs` |
|-----|-----------|--------------|--------|
| merge PR #119 | `2026-10-21T16:17:23Z` | failure | **1** (fallimento reale, il gate `validate-labels`) |
| commit `43d982d` | `2026-10-21T16:21:35Z` | failure | **0** ← punto di rottura |

Il salto `jobs: 1 → jobs: 0` cade esattamente sul commit che introduce `metadata: read`, e `ci.yml` è l'unico workflow del repo a dichiarare quella scope: gli altri quattro usano `permissions` a livello di job (`contents`, `issues`, `pull-requests`) e hanno continuato a girare.

**Il fix** è di una riga (`metadata: read` rimossa). `metadata` non serve a nulla: era già concessa.

**La difesa strutturale** è in `scripts/validate-workflows.mjs`, che già è un gate bloccante in CI (issue #73): ora valida ogni scope dichiarata in `permissions:` contro l'elenco documentato, e i valori contro `read`/`write`/`none` (con `id-token` ristretto a `write|none`). Accetta le forme compatte `{}`, `read-all`, `write-all` per non generare falsi positivi. Il test di regressione è `scripts/test-workflow-permission-scopes.sh` (T1..T5): T2 reintroduce `metadata: read` in una fixture e verifica che il gate **esca 1** — un gate che passa sempre non è un gate (lesson 43-1).

```powershell
node scripts/validate-workflows.mjs .github/workflows   # include la validazione delle scope
bash scripts/test-workflow-permission-scopes.sh          # scenario negativo (gate bloccante in CI)
```

**Regola generale**: una chiave di `permissions:` va verificata contro lo schema GitHub, non contro il parser YAML. In questa famiglia di errori il sintomo è *assenza di sintomo*: niente log, niente annotazioni, `state: active`, e un check che "passa" perché non è mai partito.

---

### 9.10 Gate reali di `ci.yml`

> **Sessione 73 (issue #224) e Sessione 74: la tabella è stata riscritta due volte.**
> `ci.yml` non è più un job unico con 18 step in sequenza: è **12 job** di cui **10 girano in
> parallelo** e due (`quality` e `detect-code`) hanno un ruolo particolare.
> **Sessione 74**: il trigger `push` su `main` è filtrato per path e su `push` girano **solo i
> job leggeri**; i 3 job `node-*` girano **solo su `pull_request`**, e saltano (riuscendo) se la
> PR tocca **solo file `.md`**. Dettaglio e misure in **§9.14.10**.
> La tabella qui sotto è l'elenco autorevole dei gate, riorganizzati per job. §9.13 ha l'audit
> temporale; **§9.14** ha le misure di prestazione prima/dopo.

Il job `quality` è il **check aggregatore**: fallisce in modo esplicito se uno
qualunque dei job paralleli è fallito, annullato o saltato. È il check che la branch
protection deve richiedere. Senza il controllo esplicito, `needs:` renderebbe
`quality` *skipped* (non *failed*) quando un job dipendente fallisce, e la branch
protection può interpretare un check saltato come successo.

| # | Job | Step / gate | Quando gira | Bloccante | Issue |
|---|-----|-------------|:-----------:|:---------:|-------
| 1 | `node-lint-typecheck` | `Installa dipendenze` (`pnpm install --frozen-lockfile`) | solo PR | sì | Story 0.1 |
| 2 | `node-lint-typecheck` | `Lint` (`pnpm run lint`) | solo PR | sì | — |
| 3 | `node-lint-typecheck` | `Typecheck` (`pnpm run typecheck`) | solo PR | sì | — |
| 4 | `node-test` | `Installa dipendenze` | solo PR | sì | Story 0.1 |
| 5 | `node-test` | `Test` (`pnpm run test`) | solo PR | sì | — |
| 6 | `node-build` | `Installa dipendenze` | solo PR | sì | Story 0.1 |
| 7 | `node-build` | `Build` (`pnpm run build`) | solo PR | sì | — |
| 8 | `gates-docs` | `Bundle in sync` (`generate-bundle.ps1 -Check`) | solo PR | **no** (`::warning::`) | #63 |
| 9 | `gates-docs` | `Lazy-state in sync` (`aggregate-state.ps1 -Check`) | solo PR | **no** (`::warning::`) | #63, #66 |
| 10 | `gates-docs` | `Fatti del README in sync con il codice` (`check-readme-facts.mjs`) | solo PR | sì | **#161** |
| 11 | `gates-docs` | `Gate "fatti del README" fail-closed` | solo PR | sì | **#161** |
| 12 | `gates-aggregate` | `Aggregator deterministico` (`test-aggregate-determinism.sh`, 37 assert) | solo PR | sì | #70 |
| 13 | `gates-bundle` | `Bundle check fail-closed` (`test-bundle-check-idempotent.sh`, 12 assert) | solo PR | sì | #104 |
| 14 | `gates-workflows` | `Workflow Actions validi` (`validate-workflows.mjs`) | solo PR | sì | #73 |
| 15 | `gates-workflows` | `Copertura git add vs $targets` | solo PR | sì | #136 |
| 16 | `gates-workflows` | `Scope permissions: valide` | solo PR | sì | **#135** |
| 17 | `gates-workflows` | `Sync origin/main prima del push su main` | solo PR | sì | **#140** |
| 18 | `gates-workflows` | `Ordinamento dei writer di main` | solo PR | sì | **#149** |
| 19 | `gates-git` | `Residui post-merge` (`test-issue-76-residue.sh`, 9 assert) | solo PR | sì | #76 |
| 20 | `gates-git` | `Label in sync con AGENTS.md` (`validate-labels.mjs`) | solo PR | sì | #110 |
| 21 | `gates-scripts` | `Procedura canonica post-merge` (`test-post-merge.sh`, 29 assert) | solo PR | sì | sessione 33 |
| 22 | `gates-procedure` | `Setup worktree` (`test-setup-worktree.sh`, 8 assert) | solo PR | sì | #53 |
| 23 | `gates-procedure` | `Pre-commit clean check` (`test-pre-commit-clean-check.sh`, 8 assert) | solo PR | sì | sessione 23 |
| 24 | `gates-procedure` | `Safe branch switch` (`test-safe-branch-switch.sh`, 11 assert) | solo PR | sì | #49 |
| 25 | `gates-procedure` | `Encoding LF dei generatori` (`test-appendline-lf-fix.ps1`, 5 scenari) | solo PR | sì | #58 |
| 26 | `gates-workflows` | `Validità YAML dei workflow` (`test-workflow-yaml-scalars.sh`, 8 assert) | solo PR | sì | sessione 74 |
| 27 | `quality` | `Esito dei gate paralleli` (aggregatore, fall-closed) | solo PR | sì | **#224** |

I due step non bloccanti sono warning per l'incompatibilità **residua di piattaforma**: i check
`-Check` confrontano output prodotto su sistemi diversi (dev Windows vs CI Linux) e possono
divergere per casi non riproducibili localmente. L'asse **versione di PowerShell** è invece
chiuso: dal baseline **PowerShell 7 (`pwsh`)** (Sessione 71) sia la dev machine che la CI girano
lo stesso engine, quindi il confronto non soffre più della differenza PS 5.1 vs 7 che era la causa
originale (issue #63). Ogni **gate di copertura e di schema** è invece bloccante, perché confronta
dati prodotti nella stessa piattaforma.

Quattro sub-gate girano dentro `validate-workflows.mjs`, che è lo step 9: `Copertura git add vs
$targets` (#136), `Scope permissions: valide` (#135), `Sync origin/main prima del push su main`
(#140) e `Ordinamento dei writer di main` (#149).

**I 5 job di gate non richiedono `pnpm install`**: `scripts/validate-*.mjs` e
`scripts/check-readme-facts.mjs` usano **solo i moduli built-in di node**, e le suite bash usano
`git` + `bash` + `pwsh`. Solo il job `node` installa le dipendenze npm. I runner GitHub
includono già `pwsh`, `bash`, `git` e `node` 20.

**Nota sui check richiesti**: i nomi dei check passati da 1 a 8 (`CI / quality`) a 9
(`CI / node`, `CI / gates-docs`, …). Il check `CI / quality` **conserva il nome** ed è quello
aggregatore, quindi la branch protection non deve cambiare. I nuovi job hanno nomi propri e
possono essere richiesti singolarmente per una revisione più granulare.

---

### 9.11 Idempotenza dei generatori: riuso del timestamp (issue #142)

Un generatore che riscrive un campo temporale a ogni esecuzione produce un diff anche quando il contenuto è invariato. Su `main` il costo è doppio: un commit di rumore per ogni merge **e** un gate che diventa dipendente dall'orologio.

**Il bug**: `scripts/aggregate-state.ps1` stampa sempre `- Ultima aggregazione: <Get-Date>` nel blocco inventory, e `Apply-Blocks` scriveva il blocco calcolato senza confrontarlo con quello già su disco. La normalizzazione esisteva **solo in `-Check`**, che è il posto in cui la differenza non si vede. `scripts/generate-bundle.ps1` aveva lo stesso difetto su `> Data:` — con l'aggravante che `Build-Bundle` accettava già un parametro `[string]$Timestamp` pensato per il riuso, e non veniva mai passato.

**Il sintomo osservato** (run `39818043647`, 2026-10-22T16:56:00Z): il gate `Aggregator deterministico` (#70, step 8) è fallito con 28 assert su 30 perché i due run consecutivi nella fixture sono caduti su minuti diversi (`16:55` → `16:56`). Con run di pochi secondi e granularità al minuto, la probabilità di strappare il confine è dell'ordine del 5-10% per run: abbastanza per far fallire un PR su un motivo non riproducibile in locale. Lo stesso gate, sul run di `main` partito un minuto dopo, è passato.

**Il fix**:

| File | Cosa fa |
|------|---------|
| `aggregate-state.ps1` | `Get-NormalizedBlock` confronta due blocchi a parità del campo mutabile; `Sync-MutableTimestamp` riusa il valore già su disco. `Apply-Blocks` li applica **solo se il blocco è identico a meno del timestamp** |
| `generate-bundle.ps1` | confronto su **tutto** il bundle a parità di `> Data:`, sostituzione **solo sulla prima occorrenza** (l'header) |
| `test-aggregate-determinism.sh` | **T11**: sentinel seminato nella riga del timestamp → verificato il riuso; contro-prova: contenuto cambiato → il campo si aggiorna |
| `test-bundle-check-idempotent.sh` | **T7**: stesso probe per `> Data:` |

**Perché il probe è un sentinel e non un confronto "prima/dopo"**: con granularità al minuto, due run ravvicinati possono produrre lo stesso valore, e un test basato sul confronto non distinguerebbe «riusato» da «riscritto nello stesso minuto». Un valore seminato (`2001-01-01 01:01`) non può coincidere per caso: con il riuso assente il test fallisce **sempre**.

**Perché la contro-prova è obbligatoria**: «il campo viene riusato» e «il campo viene riusato *solo quando il blocco non è cambiato*» sono due invarianti diverse. La prima si verifica con un riuso cieco che congela la data su un blocco stale — danno silenzioso, perché `-Check` continua a passare (lesson 44-4: un gate che blocca anche i casi legittimi viene disattivato al primo falso positivo).

**La sottigliezza della sostituzione**: `docs/AUDIT-2026-10-15.md` è in `$files` e contiene una riga `> Data: 2026-10-15`. Una sostituzione globale avrebbe riscritto il contenuto di quel documento: un danno peggiore del commit-rumore eliminato. Per questo il confronto è ampio (tutto il bundle) e la sostituzione è stretta (prima occorrenza = header).

```powershell
pwsh scripts/aggregate-state.ps1    # due esecuzioni consecutive -> zero diff
pwsh scripts/generate-bundle.ps1    # due esecuzuzioni consecutive -> "Data di generazione riusata"
bash scripts/test-aggregate-determinism.sh   # T11 incluso
bash scripts/test-bundle-check-idempotent.sh # T7 incluso
```

**Regola generale**: quando un generatore scrive un campo temporale, il confronto per il riuso deve vivere **nello stesso path** della scrittura. Normalizzare solo in `-Check` non è una verifica dell'idempotenza: è una verifica che il check non vede i propri difetti. E un test che verifica l'idempotenza con due esecuzioni ravvicinate è un test **flaky** per definizione, se il campo ha granularità al minuto: va riscritto con un probe seminato.

---

### 9.12 Ambiente PowerShell locale: provenienza, verifica e confine di encoding

La Sessione 71 (issue #218) ha dichiarato **PowerShell 7 (`pwsh`)** come baseline del repo. Questa sezione ne fissa la **provenienza** (un runtime installato ma non riproducibile non è un toolchain documentato — lesson 71-1) e il **confine oltre il quale l'ambiente non è più sicuro**: sotto Windows PowerShell 5.1 i `.ps1` del repo non solo fall-open sul flag, ma **interpretano diversamente il proprio sorgente**.

#### Provenienza (verificata il 2026-10-31)

| Aspetto | Valore |
|---|---|
| Versione | **7.6.9** (`PSEdition: Core`) |
| Tipo di installazione | pacchetto **MSIX / Microsoft Store** — `Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe`, `SignatureKind: Store` |
| Percorso reale | `C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe` |
| Alias invocabile | `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe` (App Execution Alias, reparse point da 0 byte) |
| MSI in `C:\Program Files\PowerShell\7` | **assente** — e nessuna voce di disinstallazione del prodotto nel registro |
| Data del pacchetto | creato/aggiornato il **2026-10-26 09:38** (l'installazione MSI citata da lesson 42-1 non è più quella attiva) |
| Visibilità da Git Bash | sì — `command -v pwsh` → `/c/Users/<user>/AppData/Local/Microsoft/WindowsApps/pwsh` (quindi il `.githooks/pre-push` sceglie `pwsh`, non il fallback 5.1) |

Verifiche:

```powershell
pwsh -NoProfile -c '$PSVersionTable.PSVersion'                  # 7.6.9
winget list --id Microsoft.PowerShell                            # PowerShell 7.6.9.0
Get-AppxPackage Microsoft.PowerShell | Select Version, SignatureKind, InstallLocation
```

#### Il confine: `powershell` (5.1) non è un fallback, è un rischio di corruzione

`scripts/aggregate-state.ps1` è **UTF-8 senza BOM** e contiene 9 righe con caratteri non-ASCII (`—`, `§`, `→`, `✅`, `❌`). Il **parsing del sorgente** dipende dall'engine: `pwsh` 7 legge UTF-8, Windows PowerShell 5.1 legge ANSI (Windows-1252) e trasforma `—` (3 byte UTF-8) in `â€”` (3 caratteri). La divergenza è misurata:

| Comando | Esito | Tempo | Note |
|---|---|---|---|
| `pwsh scripts/aggregate-state.ps1 -Check` | **exit 0** | 2,09 s | tutti i blocchi in sync |
| `powershell scripts/aggregate-state.ps1 -Check` | **exit 1** | 1,81 s | `[FAIL] README.md - blocco drift \| Atteso: 620 chars, Trovato: 616 chars` — drift **spurio** (4 caratteri = `—` +2, `§` +1, `à` +1) |
| `pwsh scripts/generate-bundle.ps1 -Check` | exit 0 | 1,79 s | 126 file in sync |
| `powershell scripts/generate-bundle.ps1 -Check` | exit 0 | 2,43 s | `generate-bundle.ps1` legge e scrive sempre con `-Encoding UTF8` ⇒ **immune** |

In **modalità scrittura** (default) la stessa invocazione sotto 5.1 **scrive** i letterali corrotti nei file globali (`README.md`, `SESSIONS.md`, `INDEX.md`, `11-BACKLOG.md`): mojibake + BOM, la classe di danno di lesson 36-6 e 69-5.

**Regole**:

1. **`pwsh` va invocato esplicitamente**: `powershell` (5.1) è la shell di default di Windows e di molti tool — `pwsh` è un binario diverso e va scritto per esteso.
2. **Il check F9 della session start checklist** (`pwsh -NoProfile -c '$PSVersionTable.PSVersion.Major'` → 7) va eseguito **prima** di qualunque `.ps1` del repo.
3. **I `.ps1` del repo restano ASCII-only** (o con BOM UTF-8 esplicito). Il vincolo già esiste in `docs/13-ADR/0008-lazy-state-aggregation.md`; la Sessione 72 ne ha corretto la motivazione: riguarda il **parsing** del sorgente, non solo la scrittura del file prodotto.
4. **Stato attuale** (misurato): `scripts/aggregate-state.ps1` **viola** la regola (9 righe non-ASCII, nessun BOM). Il fix (rimuovere i letterali, oppure aggiungere il BOM) è manutenzione dello script e **decisione del project owner** (D.71.4: la semantica dei gate non si cambia d'autorità).

**Implicazione per i due gate warning-only** (step 6 e 16 di `ci.yml`): la divergenza residua non è fra versioni di PowerShell — la CI gira `pwsh` come la dev machine — ma fra **encoding del sorgente** e **piattaforma** (CRLF/autocrlf, separatori di path). Con il fix di cui al punto 4, la motivazione del warning-only si riduce a "piattaforma" e i due gate potranno diventare bloccanti: **decisione del project owner**, non applicata qui.

---

### 9.13 Copertura CI delle suite di test locali

`ci.yml` esegue **13 script di verifica** (§9.10). In `scripts/` esistono però **5 suite di test che la CI non esegue**, e due di esse hanno difetti che la CI non può intercettare proprio perché non le esegue. Audit del 2026-10-31 (tutti i tempi misurati sulla dev machine, `bash` = Git Bash, `pwsh` 7.6.9):

| Suite | In CI | Tempo | Esito misurato | Difetto rilevato |
|---|:---:|---:|---|---|
| `test-aggregate-determinism.sh` | sì (step 8) | 56,0 s | 37 assert, 0 falliti | — (costo più alto del gate) |
| `test-bundle-check-idempotent.sh` | sì (step 7) | 60,4 s | 12 assert, 0 falliti | — (costo più alto del gate) |
| `test-issue-76-residue.sh` | sì (step 14) | 16,1 s | 9 assert, 0 falliti | — |
| `test-readme-facts-gate.sh` | sì (step 18) | 3,7 s | 12 assert, 0 falliti | — |
| `test-workflow-*.sh` (4 suite) | sì (step 9-13) | 2,0-3,0 s | 8-15 assert, 0 falliti | — |
| `test-post-merge.sh` | **no** | 52,4 s | 29 assert, 0 falliti | la procedura **più distruttiva** del repo (`git push origin --delete`, `git branch -D`) non ha copertura in CI |
| `test-setup-worktree.sh` | **no** | 2,9 s | **exit 1** | fallisce su Windows/Git Bash (S1: il mock `gh` non viene intercettato → lo script non fallisce come deve; S2: path POSIX `mktemp` non risolto). Su `ubuntu-latest` (CI) passerebbe |
| `test-safe-branch-switch.sh` | **no** | 6,7 s | exit 0 con **"0 passati, 0 falliti"** | **fail-open**: i tre scenari girano in subshell `( … )`, quindi gli incrementi di `pass`/`fail` non arrivano al padre e `[ "$fail" -eq 0 ]` è sempre vero ⇒ il gate non può mai fallire (lesson 43-1) |
| `test-pre-commit-clean-check.sh` | **no** | 4,7 s | 8 assert, 0 falliti | — |
| `test-appendline-lf-fix.ps1` | **no** | 6,1 s | **exit 1** (4/5) | S3 asserisce che `aggregate-state.ps1` non contenga `AppendLine`: l'aspettativa è **superata** (l'attuale fix normalizza CRLF→LF in scrittura, non elimina `AppendLine`) ⇒ test stale. In più lo scenario S5 **muta il working tree** (`git checkout -- docs/SESSIONS.md` + run dell'agregator) |

**Costi**: i due gate più pesanti (`test-aggregate-determinism.sh` + `test-bundle-check-idempotent.sh`) valgono **116,4 s** su ~213 s di gate sequenziali: ogni uno crea decine di repo git temporanei e lancia `pwsh` altrettante volte. Sono indipendenti fra loro e potrebbero girare in parallelo (o in job separati), riducendo il tempo pareggio della pipeline di circa 2 minuti.

**Perché non è stato corretto qui**: aggiungere step a `ci.yml` e modificare la semantica di un gate (da assente a bloccante) sono decisioni sul **test strategy**, che il protocollo riserva al project owner (D.71.4). I difetti sopra sono **segnalati** con evidenza misurata; il fix (`test-safe-branch-switch.sh` con i contatori riportati fuori dalle subshell, `test-appendline-lf-fix.ps1` con S3 allineato al fix corrente e senza effetti collaterali sul working tree, `test-setup-worktree.sh` portato a girare su Windows) è una PR di manutenzione a sé.

#### Chiusura dell'audit (Sessione 73, issue #224)

Il project owner ha chiesto esplicitamente di «controllare tutte le procedure automatiche e renderle
il più veloci possibili». L'audit è stato quindi **chiuso con le correzioni**, non solo documentato.
Il dettaglio dei fix e delle misure è in **§9.14**; qui il solo stato di chiusura:

| Suite | In CI (Sessione 73) | Difetto | Correzione |
|---|:---:|---|---|
| `test-safe-branch-switch.sh` | sì (job `gates-procedure`) | fail-open | gli assert scrivono su un **file di risultati condiviso**; il conteggio finale lo legge. **11 assert** ora contati (prima: 0) |
| `test-appendline-lf-fix.ps1` | sì (job `gates-procedure`) | S3 stale + S5 mutava il working tree | S3 verifica l'invariante reale («normalizza CRLF→LF in scrittura») invece dell'assenza di `AppendLine`; S5 gira su un **fixture temporaneo** e non tocca il repo |
| `test-setup-worktree.sh` | sì (job `gates-procedure`) | falliva ovunque (non solo Windows) | `cleanup_mock_env` non ripristinava `TMPDIR`/`PATH` ⇒ lo scenario successivo ereditava un `TMPDIR` cancellato (`mktemp -d` falliva) e il PATH accumulava i mock `gh`; il path POSIX veniva passato a `pwsh` senza conversione; il mock `gh` (script bash) non è eseguibile dal `pwsh` nativo su Windows. Corretti i tre: **8 assert, 0 falliti** |
| `test-pre-commit-clean-check.sh` | sì (job `gates-procedure`) | — | aggiunta alla CI senza modifiche |
| `test-post-merge.sh` | sì (job `gates-scripts`) | — | aggiunta alla CI: la procedura più distruttiva del repo ora ha copertura |

**Nota sull'audit precedente**: la Sessione 72 concludeva che «su `ubuntu-latest` (CI)
`test-setup-worktree.sh` passerebbe». Era **falso**: `mktemp` onora `TMPDIR` anche su Linux, e
`TMPDIR` puntava a una directory già cancellata — la suite falliva su **qualsiasi** piattaforma.
Il difetto era il *cleanup*, non la piattaforma.

---

### 9.14 Prestazioni delle procedure automatiche (issue #224)

Tutte le misure sono su dev machine Windows, `pwsh` 7.6.9, Git Bash, con il working tree del
repository reale. I tempi di CI sono ricavati dall'API GitHub (run `41212641314`,
2026-10-31: job `quality` = **172 s**).

#### 9.14.1 Dove andava il tempo

Il profilo del job `quality` (unico, 18 step in sequenza) si decomprime così:

| Fase | Tempo | Note |
|---|---:|---|
| `pnpm install` + lint + typecheck + test + build | ~83 s | 4 invocazioni `turbo run` **sequenziali** (52,7 s misurati con cache disabilitato) |
| 18 gate in sequenza | ~89 s | i due più pesanti da soli (56,0 s + 60,4 s) |

I due gate più pesanti erano **indipendenti**: il tempo pareggio era la **somma** di
lavoro che poteva girare in parallelo.

#### 9.14.2 Il vero costo nascosto: i processi figli

Il singolo costo più alto della sessione non era nella logica, era nel **numero di
processi figli**. `seed_repo_files` in `test-bundle-check-idempotent.sh` creava 128 stub
chiamando `dirname` + `mkdir -p` + `touch` **una volta per file**:

| Operazione | Spawn | Tempo |
|---|---:|---:|
| `seed_repo_files` (prima) | 256 processi per repo × 4 repo | **9,5 s per repo** (~38 s su 53) |
| `seed_repo_files` (dopo) | ~10 `mkdir` + 0 (`:` è una redirezione built-in) | **~50 ms per repo** |
| `git config` × 3-4 per repo temporaneo | 3-4 processi per repo | ~120-160 ms per repo |

Misura del profilo (dev machine, `mktemp -d` su Windows):

```
seed_repo_files (spawn-per-file): create=9538ms
pwsh -Command startup: 518ms
pwsh -File startup: 330ms
git init + 3 config: 261ms
```

#### 9.14.3 Risultati

| Procedura | Prima | Dopo | Δ |
|---|---:|---:|---:|
| `test-bundle-check-idempotent.sh` | 53,0 s | **11,9 s** | **−77 %** |
| `test-aggregate-determinism.sh` | 48,2 s | **39,7 s** | −18 % |
| `test-issue-76-residue.sh` | 16,1 s | **11,5 s** | −29 % |
| `test-post-merge.sh` | 52,4 s | **39,3 s** | −25 % |
| `pwsh scripts/aggregate-state.ps1 -Check` | 1,23 s | **0,91 s** | −26 % |
| `pwsh scripts/generate-bundle.ps1 -Check` | 1,37 s | **1,05 s** | −23 % |
| 4 task turbo sequenziali (`lint`+`typecheck`+`test`+`build`) | 52,7 s | 52,7 s | invariato — la forma parallela (32,8 s) **rompeva il gate**, vedi §9.14.7 |
| **Tempo pareggio della pipeline CI** | **172 s** | **73 s** (10 job in parallelo) | **−58 %** |
| `auto-bundle` su merge che tocca `docs/state/` | 2 run (20 s + 22 s) | **1 run** (il secondo viene saltato) | −22 s di latenza post-merge |

#### 9.14.4 Le modifiche, e perché sono equivalenti

| Modifica | Equivalentenza dimostrata |
|---|---|
| `generate-bundle.ps1`: `StringBuilder` al posto di `$bundle += ...` | La concatenazione PowerShell è puramente additiva: lo stesso byte. Verificato con SHA-256 identico del bundle generato dal vecchio e dal nuovo generatore sullo stesso albero |
| `generate-bundle.ps1`: `.Replace("`r`n","`n")` al posto di `-replace "`r`n", "`n"` | Il pattern è un **letterale**: nessun metacarattere di regex, quindi il risultato è identico. `.Replace` è un confronto ordinale, non una scansione regex |
| `aggregate-state.ps1`: cache per-process di elenco file, contenuti e frontmatter | I file in `docs/state/` non cambiano durante una singola esecuzione: la cache è coerente **per costruzione** |
| `aggregate-state.ps1`: i file aggregator-managed non vengono più letti per l'inventario | La loro dimensione veniva calcolata e **scartata** (issue #86, opt A): leggere `docs/SESSIONS.md` (504 KB), `docs/11-BACKLOG.md` (98 KB) e `docs/INDEX.md` (30 KB) era lavoro inutile |
| `aggregate-state.ps1`: `ReadAllText` + conteggio CRLF invece di `Get-Content -Raw` + `-replace` | Ogni CRLF→LF rimuove **esattamente** un byte: `GetByteCount(text) - nCRLF` è il valore di prima, senza allocare la copia da ~2,4 MB |
| Suite: `git config` → env var (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `GIT_CONFIG_COUNT/KEY_n/VALUE_n`) | Git >= 2.31 legge la config per-process dalle env var. Il `commit.gpgsign=false` resta garantito (era il motivo delle 3 chiamate a `git config`) |
| Suite: `mkdir`/`touch` per file → `mkdir` per directory + `: > file` | Redirezione built-in: azzera il file senza processo. Stessi path, stessi stub vuoti |
| `ci.yml`: 8 gate in parallelo + job `quality` aggregatore | Nessun gate rimosso, indebolito o reso non-bloccante. Il check `CI / quality` conserva il nome ed è **fail-closed**: fallisce esplicitamente se un job parallelo è fallito, annullato o saltato (senza questo, `needs:` produrrebbe un check *skipped*, che la branch protection può accettare come successo) |
| `ci.yml`: le 4 invocazioni `turbo run` restano **sequenziali** | Vedi §9.14.7: la forma parallela (`turbo run lint typecheck test build`, 32,8 s) **rompeva il gate**: sul runner a 2 vCPU, `build` in concorrenza con `test` fa scadere i 2 test di integrazione del fixture `db-seed/medium.json` per timeout. È la classe del lesson 30-1 |
| `auto-bundle.yml`: il run su `workflow_run` viene saltato se l'aggregator non ha prodotto un commit | `workflow_run.head_sha` è il commit su cui l'agregator ha girato: se `origin/main` è diverso, l'aggregator ha pushato e il bundle va rigenerato; se è uguale, il run su `push` ha già rigenerato il bundle da quello stato. Se l'aggregator è **fallito**, si rigenera comunque (un fallimento può aver lasciato i blocchi a metà) |

#### 9.14.5 I due difetti che la misura ha smascherato

1. **`test-safe-branch-switch.sh` era fail-open**: riportava «0 passati, 0 falliti» ed esceva 0
   **sempre**. Il contatore degli assert ora vive su un file di risultati condiviso, letto dal
   processo padre: **11 assert** contati. La suite è in CI (job `gates-procedure`).
2. **`test-setup-worktree.sh` falliva su ogni piattaforma**, non solo su Windows: `cleanup_mock_env`
   cancellava `TMPDIR` senza ripristinarlo, e `mktemp` onora `TMPDIR` anche su Linux ⇒ lo scenario
   successivo ereditava una directory cancellata. Corretti anche il path POSIX passato a `pwsh`
   (ora convertito con `cygpath -w`) e il mock `gh` (script bash, non eseguibile dal `pwsh` nativo
   su Windows: aggiunto un wrapper `gh.cmd`).

#### 9.14.6 L'ordine dei due generatori è vincolante *(unFinding della Sessione 73)*

`docs/INDEX.md` è **sia** un file in `$files` del generatore del bundle **sia** un target
dell'agregator. I due script non sono quindi indipendenti, e **l'ordine conta**:

```
pwsh scripts/aggregate-state.ps1     # 1° : scrive i blocchi AGGREGATE-* in INDEX.md
pwsh scripts/generate-bundle.ps1     # 2° : copia INDEX.md (con i blocchi nuovi) dentro BUNDLE.md
```

Nell'ordine inverso la copia di `docs/INDEX.md` dentro `docs/BUNDLE.md` resta stale rispetto ai
blocchi appena riscritti, e `generate-bundle.ps1 -Check` **fallisce** con «non è in sync» anche se
entrambi i generatori hanno girato e nessuno dei due file è corrotto. È la stessa classe dell'
ordinamento fra i due writer di `main` (issue #149), in versione locale — e il `pre-push` hook
rigenera il bundle **da solo**, quindi se l'aggregator non ha girato dopo l'ultima modifica a
`docs/INDEX.md` il bundle ne copia una versione vecchia.

**Regola operativa**: quando tocchi `docs/state/`, `docs/INDEX.md`, `docs/SESSIONS.md`,
`docs/11-BACKLOG.md` o `README.md`, lancia **prima** l'agregator e **poi** il generatore, e
verifica **entrambi** i check. La sequenza è stabile (verificata su 3 cicli consecutivi).

#### 9.14.7 Il parallelismo ha un costo: il gate che misura il tempo

Una delle ottimizzazioni proposte — una **sola** invocazione `turbo run lint typecheck test build`
invece di 4 sequenziali — **è stata implementata e poi revertita**, perché sul runner **rompeva un
gate**.

| Forma | Tempo (dev machine, cache disabilitato) | Esito sul runner |
|---|---:|---|
| 4 invocazioni `turbo run <task>` sequenziali | 52,7 s | verde (baseline) |
| 1 invocazione `turbo run lint typecheck test build` | 32,8 s | **rosso** |

Il runner GitHub ha **2 vCPU**: con i 4 task in un'unica invocazione, turbo esegue `build`
(`vite build` + `tsc`) **in concorrenza** con `test`, e il vitest riceve meno CPU. I 2 test di
integrazione del fixture `db-seed/medium.json` (5000 eventi, `packages/core/src/db/__tests__/db.test.ts`)
sono scadati: «Test timed out in 5000ms».

È **esattamente** la classe del lesson 30-1: «il test di performance misurava il **carico del
runner**, non il layer DB: con tre file di test in più faceva superare la soglia locale, e la
verifica decisiva fu togliere i file nuovi ⇒ il test gira ora in una **run separata**, con la
soglia dell'AC invariata». La soglia **non** si tocca: è un acceptance criterion.

**Regola generale**: «parallelizzare» e «aumentare il parallelismo interno di un gate» sono due
ottimizzazioni **indipendenti**, e la seconda può invalidare la prima quando un gate è
**time-sensitive**. Il parallelismo si Decide a livello di **job** (dove i gate sono processi
separati e non condividono CPU), non dentro un singolo task runner che condivide il processore.

**Alternativa scartata**: isolare `test` in un job separato (e tenere `build` in un altro) recupera
~10 s ma duplica `pnpm install` e non vale la complessità.

#### 9.14.8 Un test verde in locale non è un test verde ovunque

`test-post-merge.sh` falliva sul runner con «error: src refspec main does not match any» **solo
su Linux**, e solo perché la dev machine ha `init.defaultBranch = main` in
`C:\Program Files\Git\etc\gitconfig` mentre il runner GitHub ha il default di git, `master`.

La meccanica: `git init --bare` crea un bare repo con `HEAD → refs/heads/<init.defaultBranch>`;
`git clone` di quel repo, se `HEAD` punta a un branch **inesistente**, avvisa «remote HEAD refers
to nonexistent ref» e **non fa il checkout di nessun branch**; il successivo `git push origin main`
fallisce con «src refspec main does not match any».

Correzione: **`git init -q --bare -b main`** in tutte e tre le suite che creano un bare repo
(`test-post-merge.sh`, `test-issue-76-residue.sh`, `test-setup-worktree.sh`). Il branch iniziale
diventa **esplicito** e il test non dipende più dalla configurazione git della macchina.

**Regola generale**: un test che crea repository git temporanei deve dichiarare **esplicitamente**
il branch iniziale (`git init -b main`): `init.defaultBranch` è una configurazione **di macchina**,
non del progetto, e la CI la ha diversa da qualunque dev machine.

#### 9.14.10 La CI girava 4 volte per ogni cambiamento logico *(Sessione 74)*

Il ciclo di merge del repo produceva **4 run di CI** e **3 run `auto-*`** per ogni cambiamento
logico. I dati (API GitHub, 2026-10-31, PR #222 → #223):

| # | Quando | Workflow | Evento | Contenuto | Necessario? |
|---|---|---|---|---|---|
| 1 | apertura PR #222 | `CI` | `pull_request` | pipeline completa | **sì** |
| 2 | merge di #222 | `CI` | `push` su `main` | pipeline completa | **no** — stesso albero del run #1 |
| 3 | merge di #222 | `auto-state-aggregate` | `push` su `main` | committa `docs/BUNDLE.md` | sì (è il lavoro) |
| 4 | merge di #222 | `auto-bundle` (push) | `push` su `main` | committa `docs/BUNDLE.md` | sì (è il lavoro) |
| 5 | dopo l'aggregate | `auto-bundle` (`workflow_run`) | `workflow_run` | rigenera il bundle | **no** se l'aggregate non ha committato |
| 6 | committa dell'aggregate | `CI` | `push` su `main` | pipeline completa | **no** — ma è l'unico check sui commit dei writer |
| 7 | apertura PR #223 (doc-sync) | `CI` | `pull_request` | pipeline completa | sì, ma su una PR di **sola documentazione** |
| 8 | merge di #223 | `CI` | `push` su `main` | pipeline completa | **no** — stesso albero del run #7 |

**Il costo**: 4 × 73 s = **292 s** di CI per ogni cambiamento logico, di cui ~219 s
**ripetizioni** di validazione già fatta.

**Le cause, e cosa è stato fatto:**

| Causa | Correzione |
|---|---|
| Il trigger `push: branches: [main]` senza filtro faceva rieseguire l'**intera** pipeline su ogni merge | Il trigger `push` è ora **filtrato per path** sui 5 file che i writer automatici modificano (`docs/BUNDLE.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `README.md`). Su un merge umano che non li tocca la pipeline **non gira**: l'albero che arriva su `main` è lo stesso che la PR ha già validato. Su un merge che li tocca girano **solo i job leggeri** (`gates-docs` + `gates-workflows`, ~42 s con tutti i gate di controllo, ~21 s se si restringono a quelli strettamente necessari) |
| Su `push` giravano anche i 3 job `node-*` (73 s + 3 installazioni di dipendenze) | I 3 job `node-*` sono condizionati a `github.event_name == 'pull_request'`: su `main` il codice non è cambiato rispetto a quanto già validato dalla PR |
| Il doc-sync PR (che porta il numero di PR e l'hash di merge, noti solo **dopo** il merge) girava l'intera pipeline su file **solo `.md`** | Un job `detect-code` calcola se **almeno un** file cambiato non è un `.md`; se tutti lo sono, i 3 job `node-*` non installano le dipendenze e non eseguono i task (il job **riusce**, non viene saltato: `quality` resta fail-closed senza casi speciali). La regola è conservativa — qualsiasi `.ts`, `.json`, `.sh`, `.ps1`, `.yml` fa scattare i gate — ed è **fail-safe**: se il detector fallisce, `has_code` resta vuoto e i gate girano comunque |
| Il secondo run di `auto-bundle` girava anche quando l'aggregator non aveva prodotto nulla | Skip esatto via `workflow_run.head_sha` vs `origin/main` (vedi §9.14.4) |

**Il risultato**: per ogni cambiamento logico la CI passa da **4 run completi** a **1 run completo
+ 1 ridotto + 2-3 run leggeri**, e da **292 s** a ~**125 s**. Misurato sul merge di PR #227
(2026-10-31T18:22:29Z): la run `CI` su `main` è durata **42 s** con i 3 job `node-*` **skipped**
(0 s, nessuna installazione di dipendenze), contro i **172 s** della pipeline sequenziale
originale.

##### ⚠️ I commit dei writer automatici **non** attivano la CI — e non è colpa del filtro

Il filtro per path è stato motivato con l'idea che i commit dei writer automatici siano «gli unici
che arrivano su `main` senza essere passati da una PR». L'idea è corretta, ma **la conseguenza
pratica non è**: quei commit **non attivano nessuna run**, e non è colpa del filtro.

GitHub **non crea workflow run dai push effettuati con il `GITHUB_TOKEN` del repository** (è il
comportamento documentato che impedisce i loop ricorsivi; l'unica eccezione è
`workflow_dispatch`/`repository_dispatch`). I due writer pushano con `secrets.GITHUB_TOKEN`:

```yaml
# .github/workflows/auto-state-aggregate.yml:54 e auto-bundle.yml:101
token: ${{ secrets.GITHUB_TOKEN }}
```

Verificato sui dati (API GitHub): i commit dei writer (`3fe9483`, `e661e37`, `2f8d26d`,
`04c76fd`) **non** hanno mai attivato una run `CI` — né prima né dopo questa sessione, nemmeno
quando il trigger `push` era privo di filtro. Gli unici workflow che si attivano sui loro commit
sono quelli con trigger `workflow_run`, che la soppressione **non** colpisce: è esattamente il
workaround che `auto-bundle.yml` usa già per l'ordinamento dei writer (issue #149).

**Conseguenze, e scelte**:

- Il filtro per path, nella pratica, serve a **saltare** la CI sui merge umani che non toccano i 5
  file aggregati — non a catturare i commit dei writer.
- **L'integrità di `main` dopo i writer non è garantita dalla CI**, ma dai writer stessi: ciascuno
  è idempotente, è conservato da `git diff --quiet` prima del push, e il `workflow_run` di
  `auto-bundle` (che sopravvive alla soppressione) rigenera il bundle **dopo** l'agregator,
  riparando da solo il caso dell'ordinamento invertito (issue #149).
- Volere **anche** un check indipendente sullo stato finale di `main` richiederebbe un trigger
  `workflow_run` su `ci.yml` per i due writer: **+1 run leggera per merge**. È un trade-off
  fra copertura e numero di run, e la scelta è del project owner (non è stato fatto).

**Cosa NON è stato fatto e perché:**

- **Il doc-sync PR non è stato eliminato.** Esiste perché il frontmatter della sessione porta
  `pr:` e `merged_commit:`, che sono noti **solo dopo** il merge. Eliminarlo richiederebbe un
  cambio allo **schema** del frontmatter (contratto di D.12.x), che è una decisione del project
  owner, non un ottimizzazione della CI.
- **Il filtro per path non distingue «il bundle è cambiato perché l'ha rigenerato il writer» da
  «il bundle è cambiato perché l'ha rigenerato il pre-push hook nella PR»**: in entrambi i casi
  `docs/BUNDLE.md` cambia, e in entrambi i casi il run leggero su `main` scatta. Costa ~21 s e
  non è distinguisho con i trigger nativi. L'alternativa (trigger `workflow_run` sui writer) non
  funziona bene: `workflow_run.head_sha` è il commit su cui il writer è partito, **non** la testa
  di `main` dopo il suo commit.

#### 9.14.11 Il validatore dei workflow non validava il YAML *(Sessione 74)*

Scritto il gate che intercetta lo scalare semplice invalido, è emerso che
`scripts/validate-workflows.mjs` **non faceva parsing YAML**: lavorava sul testo con regex. Quindi
un file workflow sintatticamente rotto passava il gate, e GitHub lo **rifiutava in fase di
validazione**: run con `jobs: 0`, `conclusion: failure` a 0 secondi, nessun log, nessuna
annotazione via API — la firma identica al failure mode dell'issue #135.

Il controllo aggiunto intercetta la forma invalida più comune (scalare semplice non quotato che
contiene `: `), **salta** i block scalar (dove `: ` è testo letterale), i valori quotati, le
raccolte flow e i commenti (`#` preceduto da spazio apre un commento e non fa parte del valore),
ed è coperto da `scripts/test-workflow-yaml-scalars.sh` (8 assert: repo reale, caso invalido,
forme valide, fixture CRLF).

**Bug collaterale trovato nella stessa occasione**: il validatore divideva il file con
`text.split('\n')` **senza normalizzare il fine-riga**. Un file salvato con **CRLF** (un
contributore su Windows) lasciava un `\r` finale su ogni riga, e i pattern ancorati con `$` —
incluso quello del gate sui push su `main` (#140) — **non matchiavano più**: i controlli
fallivano **in silenzio** su un file CRLF. Ora le righe vengono normalizzate una volta sola.

#### 9.14.12 Cosa NON è stato fatto (e perché)

- **Typecheck duplicato**: `apps/web` esegue `tsc --noEmit` sia in `typecheck` sia in `build`
  (che lo precede). Si risolve togliendo il `tsc --noEmit` dallo script di `build`, ma è una
  modifica alla **definizione** del task di build, non della sua esecuzione: decisione del project
  owner (D.71.4).
- **`@ls/core` avvia vitest due volte** (`vitest run --exclude '**/perf.test.ts' && vitest run
  src/db/__tests__/perf.test.ts`): doppio startup, doppio parsing della config. Si risolve con un
  unico `vitest run` con un pattern di inclusione, che cambia il task di test: stessa decisione.
- **`ci.yml` gira anche sui push del bot**: il merge su `main` genera un commit di
  `auto-state-aggregate`/`auto-bundle`, che fa scattare `ci.yml` di nuovo (`push: branches: [main]`
  senza filtro sui path) ⇒ ogni merge costa due run complete. Si risolve con un filtro sui path
  (escludere `docs/BUNDLE.md` e i blocchi aggregati), ma il filtro va applicato **a tutti** i
  trigger perché i due writer di `main` sono serializzati (issue #149).
- **Parallelizzare le suite fra loro**: i blocchi di `test-aggregate-determinism.sh` sono indipendenti
  e potrebbero girare in parallelo, ma i contatori vivono in subshell: la lezione 43-1 (un gate che
  passa sempre non è un gate) si applica anche a chi parallelizza. Richiede il file di risultati
  condiviso già introdotto in `test-safe-branch-switch.sh`.

---

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 8 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: rimosso Sentry da §6 (D.A.1, errori loggati localmente); CSP ripulita, rimosso `https://freqblog.com` (D.A.6); Dockerfile riscritto monorepo-aware con `pnpm-workspace.yaml`; CI copertura per-package (`@ls/core`); riferimento licenza aggiornato ad Apache-2.0 (D.A.10); **nuovo §9 "Bundle script maintenance"** con comandi, convenzioni, CI check, workflow dev (post-review del bundle) |
| 0.3 | Sessione 41 (2026-10-21) | **§9.8b auto-bundle.yml** (issue #115 follow-up di PR #113): nuovo workflow `.github/workflows/auto-bundle.yml` che rigenera automaticamente `docs/BUNDLE.md` (contenuto FILE) dopo ogni push a main che tocca `$files` o i file coperti da esso. Companion di `auto-state-aggregate.yml` (che gestisce solo i blocchi `AGGREGATE-*`); serializzate via concurrency group `post-merge-main`. Chiude strutturalmente la classe di drift "BUNDLE.md non in sync post-merge" identificata dal rebasing di PR #112. **§9.7b fail-closed su flag** (issue #104): `pwsh scripts/* --check` esce 2 in PS 5.1 (doppio trattino non mappato su switch), `-Check` (singolo) continua a funzionare. Tutti gli esempi del file ora usano `-Check`. |
| 0.4 | Sessione 43 (2026-10-22) | **§9.8c copertura `git add` vs `$targets`** (issue #136): `auto-state-aggregate.yml` generava il blocco `AGGREGATE-NEXT-STEP-*` del `README.md` (quinto target, ADR-0008 V3 / #127) e poi lo scartava, perche' `README.md` mancava nella riga `git add`. Il drift restava invisibile finche' il fallback generato coincideva per caso col testo in file: si e' manifestato solo alla prima story `todo` (1.2). Fix: una parola nella riga `git add`. Difesa strutturale: assert di copertura in `scripts/validate-workflows.mjs` (gate bloccante in CI dal #73) + test di regressione `scripts/test-workflow-git-add-coverage.sh` (T1..T4, con scenario negativo). |
| 0.5 | Sessione 44 (2026-10-22) | **§9.9 scope `permissions:` valide** (issue #135): dal 2026-10-21T16:21Z `ci.yml` non eseguiva piu' alcun job — run creata, `jobs: 0`, `conclusion: failure`, `run_started_at == created_at` (0s), check-suite `completed` con 0 check-run, nessuna annotazione via API, `state: active` sull'API dei workflow. Causa: `metadata: read` nel blocco `permissions:` del job `quality` (commit `43d982d`, issue #120) — `metadata` non e' una scope dichiarabile della `GITHUB_TOKEN` (e' sempre concessa implicitamente, non e' fra quelle documentate), quindi GitHub rifiuta l'intero file in fase di validazione. Nessun parser YAML lo vede; la firma e' ambigua con un blocco billing, escluso perche' gli altri 5 workflow dello stesso repo sugli stessi runner erano verdi nella stessa finestra. Diagnosi: tabella `jobs` x `conclusion` dei 60 run — il salto `1 → 0` cade su `43d982d`. Fix: rimossa la riga. Difesa: validazione delle scope in `scripts/validate-workflows.mjs` (gate bloccante dal #73) + `scripts/test-workflow-permission-scopes.sh` (T1..T5, con scenario negativo). **§9.10 gate reali di `ci.yml`** (nuova): elenco autorevole dei 14 step, con bloccante/non-bloccante e issue di riferimento, verificato 1:1 contro il workflow; §2.1 ora dichiara esplicitamente di essere uno scheletro di progetto e rimanda a §9.10. |
| 0.6 | Sessione 45 (2026-10-22) | **§9.8d sync con `origin/main` dei writer di `main`** (issue #140): `auto-state-aggregate.yml` falliva su ogni merge con `! [rejected] main -> main (non-fast-forward)` (run `39802198985`, `39803721229`). Causa: il concurrency group `post-merge-main` serializza i *run*, non i *checkout*, e `actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del merge commit; quando `auto-bundle.yml` ha gia' pushato sullo stesso merge, il secondo writer pusha da un checkout stale e viene rifiutato. Conseguenza: il meccanismo di auto-guarimento di ADR-0008 era spento e il doc-sync della Story 1.2 (PR #139) non e' mai arrivato su `main` — `README.md` continuava ad annunciarla come «prossima story». Fallimento silenzioso: merge verde, `ci.yml` verde, blocchi aggregati indietro, nessun gate che lo segnali. Fix: step «Sync con origin/main» (`git fetch` + `git rebase`, fallback `git reset --hard`), identico a quello del companion. Difesa: gate in `scripts/validate-workflows.mjs` (bloccante in CI dal #73) che richiede un sync **prima** di ogni `git push origin main` e non tassa i writer di branch + `scripts/test-workflow-push-sync.sh` (T1..T5, 15 assert, con scenario negativo e verifica dell'ordine). **§9.10** aggiornata: 15 step, con il nuovo gate in posizione 12. |
| 0.7 | Sessione 46 (2026-10-22) | **§9.11 idempotenza dei generatori: riuso del timestamp** (issue #142): `aggregate-state.ps1` ristampava `Get-Date` nel blocco inventory a ogni run, e la normalizzazione esisteva solo in `-Check` — quindi la garanzia «il timestamp viene riusato quando il blocco non cambia altro» (issue #70) era documentata ma non implementata nel path di scrittura. Sintomo: il gate `Aggregator deterministico` fallito sul run `39818043647` (16:55 → 16:56), cioè un gate bloccante dipendente dall'orologio, ~5-10% dei run. Difetto gemello in `generate-bundle.ps1`: `Build-Bundle -Timestamp` esisteva ma non veniva passato, e `auto-bundle` committava un nuovo `> Data:` dopo ogni merge a contenuto identico (nessun gate lo vedeva). Fix: `Get-NormalizedBlock` + `Sync-MutableTimestamp` in `Apply-Blocks`; in `generate-bundle.ps1` confronto su tutto il bundle con sostituzione **solo** sulla prima `> Data:` (i documenti inclusi ne hanno una propria, `docs/AUDIT-2026-10-15.md`). Test con **sentinel seminato** invece di confronto temporale (`test-aggregate-determinism.sh` T11, `test-bundle-check-idempotent.sh` T7), entrambi con contro-prova «contenuto cambiato → il campo si aggiorna»; `test-bundle-check-idempotent.sh` guadagna anche `ps_path`, che ripara T4-T6 su Windows (path POSIX non risolti dal call operator di pwsh). |
| 0.8 | Sessione 47 (2026-10-26) | **§9.8e ordinamento fra i due writer di `main`** (issue #149): il concurrency group `post-merge-main` serializza i *run* ma non ne impone l'ordine*, e `auto-bundle` copia il contenuto dei file che `auto-state-aggregate` modifica — quindi può copiare blocchi aggregati stale. Caso reale: merge della PR #147 (2026-10-26T12:50Z), `auto-bundle` alle 12:50:23 e `auto-state-aggregate` alle 12:50:55: il bundle copiò i blocchi vecchi, il guard idempotente scrisse «già in sync» e non committò, e il drift di 6 righe in `docs/BUNDLE.md` restò silenzioso (il gate sul bundle è warning-only). Il commit del bot non poteva auto-correggerlo: il push con `GITHUB_TOKEN` sopprime i workflow run innescati dal token stesso. Fix (opzione A, Boss): trigger `workflow_run` su `auto-state-aggregate` in `auto-bundle.yml` — è agganciato alla *conclusione* del workflow, quindi sopravvive alla soppressione del GITHUB_TOKEN ed è il workaround documentato per i workflow che si innescano a vicenda; con esso il bundle rigenera **sempre** dopo che l'aggregate ha committato. Difesa: quarto sub-gate in `scripts/validate-workflows.mjs` (verifica la presenza del trigger **e** che il nome in `workflows:` combaci con il `name:` reale del producer, altrimenti il trigger non scatterebbe mai, in silenzio) + `scripts/test-workflow-writer-ordering.sh` (T1..T5, 6 assert, scenario negativo). **§9.10** aggiornata: 16 step, con il nuovo gate in posizione 13. |
| 0.9 | Sessione 54 (2026-10-27) | **§9.8f gate "fatti del README"** (issue #161): il README dichiarava 8 piattaforme importabili (Deezer, Tidal, SoundCloud inesistenti), audio features e analisi/mood/ricordi come feature presenti, e un conteggio di stato duplicato — la prosa era quella del bootstrap (`ebdab9d`, 2026-10-14) perché i merge delle Story 1.2 e 1.3 non avevano toccato il README e nessuno dei 16 gate di `ci.yml` confrontava la prosa con il codice (pipeline verde, README falso). Causa radice di **ownership**, non di tooling: `README.md` è ibrido (blocco `AGGREGATE-NEXT-STEP-*` generato + prosa scritta a mano) e non era in nessuna tabella di ownership; la regola nuova è in `AGENTS.md` §"Ownership del `README.md`" (D.161.1). Gate: `scripts/check-readme-facts.mjs`, **read-only** (0 = in sync, 1 = drift, 2 = errore di ambiente): confronta l'elenco delle piattaforme con `ACTIVE_PLATFORMS` + `ADAPTER_FACTORIES` + le classi in `packages/core/src/adapters/`, vieta le capability EPIC 2/EPIC 4 fuori dalla roadmap, vieta i conteggi duplicati in prosa. **Nessuna modalità di scrittura**: il README è già target di `aggregate-state.ps1`, e un secondo writer riprodurrebbe la race fra i writer di `main` risolta dal #149. Test di scenario negativo `scripts/test-readme-facts-gate.sh` (T1..T9, 12 assert). **§9.10** aggiornata: 18 step, con i due nuovi gate in posizione 17 e 18 (entrambi bloccanti). |
| 1.0 | Sessione 62 (2026-10-28) | **§2.1 CSP** allineata alla spec `21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED, issue #187): `connect-src` aggiunge i due host della pipeline delle audio features (D-AF.9) — `https://acousticbrainz.org` (bonus sui MBID) e `https://audio-ssl.itunes.apple.com` (download dell'anteprima audio di 30 s, analizzata **in locale**: i byte non escono e non vengono persistiti). Sono gli unici due host aggiunti: nessun altro servizio entra in `connect-src`. `'wasm-unsafe-eval'` era già presente per Essentia.js e resta |
| 1.1 | Sessione 66 (2026-10-30) | **§2.1 CSP**: `connect-src` ammette anche `https://itunes.apple.com`, l'host che **risponde** alla ricerca del preview (issue #196, ratifica del project owner). La v1.0 della spec `21-AUDIO-FEATURES.md` elencava in `connect-src` i due host che **non** sono quello della ricerca (l'API di AcousticBrainz e il **CDN** dei file audio): la CSP bloccava `GET https://itunes.apple.com/search` e la pipeline degradava **sempre** ad AcousticBrainz/euristico — Essentia mai chiamabile, `valence`/`energy` mai misurate, mood tracker senza dati (D.A.1). **D-AF.9 è emendata** (`21` v1.1): i **tre** host sono gli unici aggiunti. Il codice applicato al bundle (`apps/web/src/security/`) includeva già l'host della ricerca dal merge della PR #197 (Sessione 64): la modifica è l'allineamento della **dichiarazione** al codice |
| 1.2 | Sessione 67 (2026-10-30, issue #201) | **§5.3 Licenza e offerta del sorgente (AGPL-3.0)** (nuova): il repository passa da Apache-2.0 ad **AGPL-3.0** (D-AF.2, `21-AUDIO-FEATURES.md` §2.4, ratificata dal project owner); l'obbligo del **§13** (offerta del Corresponding Source agli utenti che interagiscono in rete) è il requirement dell'issue **#202**, non ancora implementato. **§5.1 CSP**: nota sul **nuovo host** che il download on-demand del database geo introduce (D-B.2, `13-ADR/0009` v1.0 🟢) — va dichiarato nella story 4.4 insieme al codice che lo scarica, con la regola imparata dalla issue #196 (la CSP applicata e la spec devono dire la stessa cosa). |
| 1.3 | Sessione 71 (2026-10-31) | **Baseline PowerShell 7 (`pwsh`)** per gli script in `scripts/*.ps1`. `pwsh` era già disponibile sulla dev machine dalla Sessione 42 (lesson 42-1, pwsh 7.6.7) e la CI usa `shell: pwsh` da sempre, ma la **documentazione** era rimasta ancorata al world di PS 5.1: il README avvertiva ancora che «senza `pwsh`» i gate richiedevano il singolo trattino, `§9.1` prescriveva «MAI `--check`», `§9.7b` descriveva il bug #104 come se fosse il caso normale e la motivazione dei due gate warning-only era attribuita alla differenza **PS 5.1 vs 7** invece che a quella **di piattaforma**. §9.1 riscritta: il doppio trattino in `pwsh` viene normalizzato sul singolo **prima** del binding, quindi `--check` e `-Check` sono equivalenti (verificato su pwsh 7.6.9); il fail-open dell'issue #104 è un bug di **5.1** e non si reproduce con il baseline corrente. La forma canonica resta a **singolo trattino** (`-Check`), unica forma con comportamento identico su 5.1 e 7 e quella indicata dal guard fail-closed. §9.7b: il guard resta in piedi ma non scatta più nello scenario che l'ha motivato — protegge i flag davvero inesistenti e le invocazioni da shell 5.1. §9.10: la motivazione dei due step warning-only è riformulata — l'asse versione di PowerShell è chiuso, resta quello di piattaforma (dev Windows vs CI Linux). Nessuna modifica al codice degli script né alla semantica dei gate in CI. |
| 1.4 | Sessione 72 (2026-10-31) | **§9.12 Ambiente PowerShell locale** (nuova): provenienza dell'installazione verificata (`pwsh` **7.6.9**, pacchetto **MSIX/Store** `Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe`, alias per-utente in `WindowsApps`, **nessun MSI** in `C:\Program Files\PowerShell\7` e nessuna voce di disinstallazione nel registro; pacchetto creato/aggiornato il 2026-10-26 09:38) con i comandi di verifica (`pwsh -NoProfile -c '$PSVersionTable.PSVersion'`, `winget list --id Microsoft.PowerShell`, `Get-AppxPackage Microsoft.PowerShell`). La sezione fissa anche il **confine**: `scripts/aggregate-state.ps1` è UTF-8 **senza BOM** e contiene 9 righe con caratteri non-ASCII ⇒ sotto 5.1 il **parsing del sorgente** li sovradecodifica (`—` → `â€”`) e `-Check` esce **1** con drift spurio (attesi 620 char, trovati 616), mentre in modalità scrittura il mojibake verrebbe scritto nei file globali; `generate-bundle.ps1` invece è immune (legge/scrive sempre con `-Encoding UTF8`). Il vincolo «ASCII-only nei `.ps1`» di `13-ADR/0008` viene corretto: riguarda il **parsing**, non solo la scrittura. Il fix dello script (rimuovere i letterali o aggiungere il BOM) è **decisione del project owner** (D.71.4) e non è applicato. **§9.13 Copertura CI delle suite di test locali** (nuova): 5 suite presenti in `scripts/` **non** eseguite da `ci.yml` (`test-post-merge.sh`, `test-setup-worktree.sh`, `test-safe-branch-switch.sh`, `test-pre-commit-clean-check.sh`, `test-appendline-lf-fix.ps1`), con tempi misurati e difetti rilevati: `test-safe-branch-switch.sh` è **fail-open** (i contatori vivono dentro subshell ⇒ "0 passati, 0 falliti" e uscita sempre 0), `test-appendline-lf-fix.ps1` ha S3 **stale** (64 `AppendLine` sono il fix corrente, non una regressione) e S5 **muta il working tree**, `test-setup-worktree.sh` fallisce su Windows/Git Bash (mock `gh` non intercettato + path POSIX). I due gate più pesanti (`test-aggregate-determinism.sh` 56,0 s + `test-bundle-check-idempotent.sh` 60,4 s) valgono 116,4 s dei ~213 s di gate sequenziali e sono indipendenti ⇒ parallelizzabili. Nessuna modifica al codice degli script né alla semantica dei gate in CI. |
| 1.5 | Sessione 73 (2026-10-31, issue #224) | **§9.10 Gate reali di `ci.yml`** (riscritta): `ci.yml` passa da **1 job sequenziale con 18 step** a **11 job** di cui 10 in parallelo (`node-lint-typecheck`, `node-test`, `node-build`, `gates-docs`, `gates-aggregate`, `gates-bundle`, `gates-workflows`, `gates-git`, `gates-scripts`, `gates-procedure`) + `quality` aggregatore. Il check `CI / quality` **conserva il nome** ed è fail-closed (fallisce se un job parallelo è fallito/annullato/saltato: senza il controllo esplicito, `needs:` produrrebbe un check *skipped*, che la branch protection può accettare come successo). I 5 job di gate **non richiedono `pnpm install`** (`validate-*.mjs` e `check-readme-facts.mjs` usano solo i moduli built-in di node). **`pnpm run verify`** (nuovo script = `turbo run lint && turbo run typecheck && turbo run test && turbo run build`): i 4 gate del CI in una sola invocazione locale. Le 4 invocazioni turbo **restano sequenziali** nella CI: la forma parallela (`turbo run lint typecheck test build`, 32,8 s misurati) **rompeva il gate** — sul runner a 2 vCPU `build` in concorrenza con `test` faceva scadere per timeout i 2 test di integrazione del fixture `db-seed/medium.json` (classe del lesson 30-1: la soglia di un test time-sensitive è un acceptance criterion e non si tocca). Inoltre `git init` nelle suite che creano repository temporanei dichiara **esplicitamente** `-b main`: `init.defaultBranch` è una configurazione **di macchina** (la dev machine ha `main`, il runner GitHub `master`) e senza il fix `test-post-merge.sh` falliva sul runner con «src refspec main does not match any». **§9.13** (nuova sezione *Chiusura dell'audit*): le 5 suite che la CI non eseguiva sono ora **in CI**, con i difetti corretti — `test-safe-branch-switch.sh` **fail-open** (contatori fuori dalle subshell, ora 11 assert), `test-appendline-lf-fix.ps1` S3 **stale** (l'invariante reale è «normalizza CRLF→LF», non «0 AppendLine») e S5 che **mutava il working tree** (ora gira su fixture temporaneo), `test-setup-worktree.sh` che falliva **su ogni piattaforma** (`TMPDIR` non ripristinato nel cleanup, path POSIX non convertito, mock `gh` non eseguibile dal `pwsh` nativo su Windows). **`§9.14 Prestazioni delle procedure automatiche`** (nuova): il profilo (dove andava il tempo), il costo nascosto dei **processi figli** (`seed_repo_files` = 256 spawn per repo = 9,5 s per repo → ~50 ms), la tabella dei risultati (`test-bundle-check-idempotent.sh` 53,0 → 11,9 s; `aggregate-state.ps1 -Check` 1,23 → 0,91 s; `generate-bundle.ps1 -Check` 1,37 → 1,05 s; **tempo pareggio della pipeline 172 s → 73 s**), l'equivalenza dimostrata di ogni modifica, il **costo del parallelismo** (§9.14.7), il `git init` con branch implicito (§9.14.8) e ciò che **non** è stato fatto (typecheck duplicato, doppio startup di vitest, CI sui push del bot, parallelizzazione interna delle suite) |