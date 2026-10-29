# 12 — DevOps, Deployment & Security

> Status: 🟡 DRAFT · Versione 1.0 · Sessione 62 (2026-10-28, issue #187) · gate "fatti del README"
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
  connect-src 'self' https://api.musicbrainz.org https://*.musicbrainz.org https://acousticbrainz.org https://audio-ssl.itunes.apple.com; 
  worker-src 'self' blob:;
  frame-ancestors 'none';
```
*Nota*: `'wasm-unsafe-eval'` è necessario per Essentia.js (WebAssembly). `connect-src` limita le chiamate di rete ai **provider approvati**: MusicBrainz (enrichment + bonus audio features su MBID) e, dal Sessione 62, i due host delle audio features (D-AF.9). **Rimosso** `https://freqblog.com` (D.A.6: provider non più usato).

**Aggiornamento (Sessione 62, spec `21-AUDIO-FEATURES.md` v1.0 🟢 APPROVED)**: la pipeline delle audio features ha due host in più, entrambi dichiarati nella spec (D-AF.9): `https://acousticbrainz.org` per il bonus sui MBID e `https://audio-ssl.itunes.apple.com` per il **download dell'anteprima audio di 30 s**, che viene analizzata in locale e non esce dal dispositivo. Sono gli unici due host aggiunti: nessun altro servizio entra in `connect-src`.

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

Elenco dei 18 step nominati del job `quality`, verificato riga per riga contro `.github/workflows/ci.yml` il 2026-10-27 (Sessione 54, issue #161; la Sessione 47 ne aveva verificati 16). È l'elenco autorevole: §2.1 è uno scheletro di progetto e va letto insieme a questa tabella, non al posto suo.

| # | Step | Bloccante | Issue |
|---|------|:---------:|-------|
| 1 | `Installa dipendenze` (`pnpm install --frozen-lockfile`) | sì | Story 0.1 |
| 2 | `Lint` | sì | — |
| 3 | `Typecheck` | sì | — |
| 4 | `Test` | sì | — |
| 5 | `Build` | sì | — |
| 6 | `Bundle in sync` (`generate-bundle.ps1 -Check`) | **no** (`::warning::`) | #63 |
| 7 | `Bundle check fail-closed` | sì | #104 |
| 8 | `Aggregator deterministico` | sì | #70 |
| 9 | `Workflow Actions validi` (`validate-workflows.mjs`) | sì | #73 |
| 10 | `Copertura git add vs $targets` | sì | #136 |
| 11 | `Scope permissions: valide` | sì | **#135** |
| 12 | **`Sync origin/main prima del push su main`** | sì | **#140** |
| 13 | **`Ordinamento dei writer di main`** | sì | **#149** |
| 14 | `Residui post-merge` | sì | #76 |
| 15 | `Label in sync con AGENTS.md` | sì | #110 |
| 16 | `Lazy-state in sync` (`aggregate-state.ps1 -Check`) | **no** (`::warning::`) | #63, #66 |
| 17 | **`Fatti del README in sync con il codice`** (`check-readme-facts.mjs`) | sì | **#161** |
| 18 | **`Gate "fatti del README" fail-closed`** | sì | **#161** |

I due step non bloccanti sono warning per l'incompatibilità residua PowerShell 5.1 (dev Windows) vs PowerShell 7 (CI Linux): i check `-Check` confrontano output prodotto su piattaforme diverse e possono divergere per casi non riproducibili localmente. Ogni **gate di copertura e di schema** è invece bloccante, perché confronta dati prodotti nella stessa piattaforma.

**Verifica**: i 18 step della tabella corrispondono 1:1 ai `- name:` presenti in `ci.yml` (nessuno nell'elenco manca, nessuno nel file è assente dall'elenco). Quattro sub-gate girano dentro `validate-workflows.mjs`, che è lo step 9: `Copertura git add vs $targets` (#136), `Scope permissions: valide` (#135), `Sync origin/main prima del push su main` (#140) e `Ordinamento dei writer di main` (#149).

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

## Changelog

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
