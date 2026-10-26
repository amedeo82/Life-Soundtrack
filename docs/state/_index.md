# 📦 state/ — Sorgenti atomiche per la sincronizzazione lazy

> Status: 🟢 LIVE · Introdotto in Sessione 25 (2026-10-18), ADR-0008
> Scopo: separare le **informazioni atomiche di stato** (story, sessioni) dai **file di stato globale** (`docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`) per eliminare i conflitti di merge generati da agenti paralleli che fanno doc-sync IN PR (D.21.1 di Sessione 21).

---

## Regola d'oro

**I file qui dentro sono editati dalle PR delle singole story / sessioni.** I file in `docs/` (a parte `INDEX.md`/`SESSIONS.md`/`BUNDLE.md`/`11-BACKLOG.md` che vengono **rigenerati**) **non sono più toccati manualmente dalle PR di implementazione**.

| Tipo di PR | Cosa può modificare |
|---|---|
| PR di **implementazione** (story, bug fix) | solo i file nelle rispettive aree + `docs/state/<propria-story>/` + `state/<propria-sessione>/` (se rilevante) |
| PR di **aggregazione** (manutenzione state) | `scripts/aggregate-state.ps1`, `docs/13-ADR/*`, questo README |
| PR di **introduzione policy** (S25) | tutto (necessario per la migration iniziale) |

L'eccezione "PR di introduzione policy" si applica **solo a questa PR** (PR #24 / `feat/24-lazy-state-aggregation`). Vedi ADR-0008 §"Conseguenze".

---

## Layout

```
docs/state/
├── _index.md                    ← questo file (README della gerarchia)
├── sessions/
│   ├── 22-pwa.md                ← frontmatter + body della Sessione 22
│   ├── 23-fix-hook.md
│   └── 24-i18n.md
└── stories/
    ├── 0.5-pwa.md               ← stato atomico + log delle lesson per Story 0.5
    └── 0.6-i18n.md
```

### Convenzione di naming

- `sessions/<N>-<slug>.md` — `N` = numero sessione (zero-padded a 2 cifre), `slug` = kebab-case del titolo
- `stories/<id>-<slug>.md` — `id` = `0.5` / `1.2` / `2.1` (story-id), `slug` = kebab-case del titolo

### Allocazione del numero di sessione *(vincolante, issue #105)*

`N` in `sessions/<N>-<slug>.md` **deve essere univoco** nel momento in cui la PR viene aperta. Una collisione (due agenti paralleli scelgono lo stesso `N`) genera due righe "Sessione N" in `SESSIONS.md` + `docs/INDEX.md` (la tabella diventa formalmente in sync con se stessa ma semanticamente sbagliata) ed esce da `pwsh scripts/aggregate-state.ps1 -Check` con exit 0 = **fail-open**.

**Procedura di pre-check obbligatoria prima di creare il file** (incluso il primo commit della worktree, vedi `scripts/setup-worktree.ps1` step 5):

```powershell
# 1. fetch + lookup del massimo N attualmente su origin/main
git fetch origin

$N = (git ls-tree --name-only origin/main docs/state/sessions/ |
      ForEach-Object { Split-Path $_ -Leaf } |
      Where-Object { $_ -match '^[0-9]+-' } |
      ForEach-Object { [int]($_ -split '-')[0] } |
      Measure-Object -Maximum).Maximum + 1

# 2. sanity: lookup locale per evitare collisioni con file appena creati ma
#    non ancora pushati (raro in pratica ma difesa in profondita)
$NLocal = (Get-ChildItem docs/state/sessions/*.md |
           ForEach-Object { [int]($_.BaseName -split '-')[0] } |
           Measure-Object -Maximum).Maximum
if ($NLocal -ge $N) { $N = $NLocal + 1 }

Write-Host "Prossimo numero di sessione disponibile: $N"
```

**Difesa di seconda linea (rilevamento, non prevenzione)**: `aggregate-state.ps1` (issue #105) include `Find-DuplicateSessionNumbers`. In modalita' `-Check` se rileva due file con lo stesso `Number` emette:

```
[FAIL] 1 numeri di sessione duplicati (issue #105):
  - Number=41:
      docs/state/sessions/41-geo-context-spec.md
      docs/state/sessions/41-alias.md
  Rinumerare uno dei file (es. <N+1>-<slug>.md) e rieseguire il check.
```

…ed esce con codice 1. In modalita' default (apply) emette `[WARN]` ma continua a scrivere, perche' il drift a quel punto e' gia' su `main` e deve essere risolto da un intervento umano.

Storia: il caso reale e' la **Sessione 41** (2026-10-21): l'agente su #98 (spec Apple Music) e l'agente su #99 (geo & contesto) hanno entrambi scelto `40` come numero di sessione. La PR #100 dell'altro agente e' stata mergiata mentre la #99 era in lavorazione; a meta' sessione `main` conteneva `40-apple-music-adapter-spec.md` e `40-geo-context-spec.md`. La collisione e' stata rilevata durante `git rebase` (lesson 41-4) e risolta rinumerando quest'ultimo a `41-geo-context-spec.md` + rebase manuale.

---

## Schema frontmatter

### `state/sessions/<N>-<slug>.md`

```markdown
---
number: 22                          # numero sessione (intero)
title: "..."                         # titolo breve della sessione
date: 2026-10-18                     # data ISO
state: 🟡 | 🟢                       # stato lavoro: 🟡 = in corso, 🟢 = chiuso (opzione C, issue #106)
merged: true | false                 # se la PR/la sessione è stata mergiata (opzione C, issue #106)
merged_commit: "sha"                 # merge commit SHA (post-merge, solo se merged=true)
merged_date: "2026-10-21T15:35:48Z"  # data merge (post-merge, solo se merged=true)
branch: feat/...                     # branch usato
pr: 19                               # numero PR (0 se nessuna aperta)
claim: kilo-...                      # agent-ID che ha fatto claim
---

## Sintesi
[1-2 paragrafi]

## Decisioni
[tabella D.X.Y — Motivazione]

## Lesson learned
[tabella osservazioni]

## Documenti aggiornati
[bullet list file modificati]
```

### `state/stories/<id>-<slug>.md`

```markdown
---
id: "0.5"                            # story-id (stringa con punto)
title: "PWA e service worker"
phase: 0                             # numero fase
area: devops                         # area:adapter / area:devops / area:ui / area:db / ...
status: done                         # 🟡/⬚/👀/✅/❌/🛑 (vedi 11-BACKLOG §"Stato di una Story")
priority: B                          # B=blocker / I=important / L=later
depends_on: ["0.1"]                  # lista story-ids prerequisite
branch: feat/7-pwa-and-service-worker
pr: 19
merged_commit: "3fa3c0d"             # merge commit SHA (post-merge)
merged_date: 2026-10-18              # data merge
---

## Descrizione
[testo della story, spec rilevante]

## Task
- [x] T<id>.1 — ...
- [x] T<id>.2 — ...

## Acceptance criteria
- [x] AC 1 — ...
- [x] AC 2 — ...

## Lesson learned
[timeline errori/fix]

## Documenti aggiornati
[bullet]
```

---

## Aggregazione

Eseguita da `scripts/aggregate-state.ps1`:

```powershell
pwsh scripts/aggregate-state.ps1          # rigenera SESSIONS.md, 11-BACKLOG.md "Stato di avanzamento"
pwsh scripts/aggregate-state.ps1 --check  # verifica sync (CI gate)
pwsh scripts/aggregate-state.ps1 --list   # lista file sorgente
```

Trigger automatico via GH Action `.github/workflows/auto-state-aggregate.yml` su `push: branches: [main]` (non-bloccante: committa direttamente eventuali diff di INDEX/SESSIONS/BACKLOG/BUNDLE).

---

## Stato della migration (S25)

| File | Stato | Note |
|------|-------|------|
| `state/sessions/22-pwa.md` | ✅ migrata da SESSIONS.md | entry S22 |
| `state/sessions/23-fix-hook.md` | ✅ migrata | entry S23 (issue #20) |
| `state/sessions/24-i18n.md` | ✅ migrata | entry S24 (issue #5 / Story 0.6) |
| `state/sessions/27-worktree-default.md` | ✅ migrata | entry S27 (issue #53, worktree-as-default) |
| `state/sessions/28-pr-template-and-branch-protection.md` | ✅ migrata | entry S28 (issue #51, PR template + branch protection) |
| `state/sessions/30-crlf-and-workflow-fix.md` | ✅ migrata | entry S30 (issue #58, CRLF + workflow if:always) |
| `state/sessions/31-agents-md-cleanup.md` | ✅ migrata | entry S31 (cleanup AGENTS.md v1.9, audit workflow) |
| `state/stories/0.1-monorepo-setup.md` | ✅ migrata | da Story 0.1 BACKLOG + 18-DEV-LOG §4 (issue #127, ADR-0008 V3) |
| `state/stories/0.2-schema-db-dexie.md` | ✅ migrata | da Story 0.2 BACKLOG + 18-DEV-LOG §6 (issue #127, ADR-0008 V3) |
| `state/stories/0.5-pwa.md` | ✅ migrata | da Story 0.5 BACKLOG + 18-DEV-LOG §11 |
| `state/stories/0.6-i18n.md` | ✅ migrata | da Story 0.6 BACKLOG + 18-DEV-LOG §12 |
| `state/stories/0.4-ui-import.md` | ✅ migrata | da PR #71 (Sessione 37, issue #84) |
| `state/stories/1.1-adapter-youtube-music.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.1" (issue #127, ADR-0008 V3): prima non-done, alimenta il blocco `AGGREGATE-NEXT-STEP-*` del README |
| `state/stories/1.2-adapter-apple-music.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.2" (Sessione 42, issue #132, PR #134): `status: todo`, riattiva `AGGREGATE-NEXT-STEP-*` dopo il fallback dovuto al merge della 1.1 |
| `state/sessions/42-approve-apple-music-spec.md` | ✅ creata | Sessione 42 (PR #134): approvazione spec Apple Music |
| `state/sessions/43-readme-next-step-git-add.md` | ✅ creata | Sessione 43 (issue #136): fix dello staging di `README.md` in `auto-state-aggregate.yml` + gate di copertura `git add` vs `$targets` |
| `state/stories/1.3-adapter-lastfm-listenbrainz.md` | ✅ creata | da `11-BACKLOG.md` §"Story 1.3" (Sessione 47, issue #145): prima non-done della 1.3, `status: in_progress` |
| `state/sessions/47-listenbrainz-lastfm-adapter-spec.md` | ✅ creata | Sessione 47 (issue #145, #144): spec adapter ListenBrainz + Last.fm, Story 1.3 perimetro corretto, Story 1.5 ridimensionata |
| `state/sessions/48-fix-bundle-writer-ordering.md` | ✅ creata | Sessione 48 (issue #149): fix race fra i due writer di `main` — trigger `workflow_run` in `auto-bundle.yml` + quinto gate di `validate-workflows.mjs` |
| `state/sessions/49-adr-0010-remote-source.md` | ✅ creata | Sessione 49 (issue #148): ADR-0010 — sorgenti remote nel contratto `PlatformAdapter` (`parseRemote?()` + `RemoteSource`), `05§4.1` |
| `state/sessions/50-lastfm-adapter-spec.md` | ✅ creata | Sessione 50 (issue #144): spec adapter Last.fm — percorso API via proxy CORS + percorso file, `eventKey` al minuto |
| `state/sessions/51-lastfm-spec-approval.md` | ✅ creata | Sessione 51 (issue #144): promozione spec Last.fm a 🟢 APPROVED v1.0 + apertura dell'issue di implementazione della Story 1.3 (#155) |
| Sessioni 0..21, 25, 26 | ⬚ TODO (migration incrementale) | restano in `docs/SESSIONS.md` legacy fino a V2 |
| Stories 0.1, 0.2 | ✅ migrate | chiuse con #127, ADR-0008 V3 (2026-10-21) |
| Stories 1.x+ | ⬚ TODO (migration incrementale) | la 1.1 e la 1.2 hanno state file (per `AGGREGATE-NEXT-STEP-*`); la 1.2 è stata creata **all'approvazione della spec** e non al claim, eccezione motivata nella Sessione 42. La 1.3+ seguirà il pattern "crea lo state file al primo claim `agent-ready`" |

> **Nota (Sessione 37, issue #84)**: le 7 story della Fase 0 sono tutte `done` e 6/7 hanno state file (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7 — la 0.7 e 0.5/0.6/0.4 sono pre-V3, 0.1/0.2 aggiunte con issue #127, ADR-0008 V3, per alimentare il blocco `AGGREGATE-NEXT-STEP-*` del README).
>
> Story 1.1 ha il primo state file di una story non-done: serve ad alimentare il blocco `AGGREGATE-NEXT-STEP-*` introdotto con ADR-0008 V3 (issue #127). Le altre 1.x+ seguiranno il pattern "crea lo state file al primo claim `agent-ready`" (migration incrementale).
>
> **Nota (Sessione 42, issue #132)**: la 1.2 anticipa il pattern — il suo state file nasce all'**approvazione della spec** (PR #134) e non al claim, perché è la story che il blocco `AGGREGATE-NEXT-STEP-*` deve indicare come prossima: senza di esso il README resta sul fallback "Nessuna story non-done migrata" per un'intera sessione dopo ogni merge. Il costo (un file da aggiornare in più se lo scope cambia) è minore del beneficio.

Vedi ADR-0008 §"Piano di rollout" per la migration V2 (futuro).

---

## Riferimenti

- **ADR-0008** (`docs/13-ADR/0008-lazy-state-aggregation.md`) 🟢 APPROVED — spec completa
- **Issue #24** — contenitore del lavoro, claim `kilo-HP-ELITEBOOK-hjoe`
- **AGENTS.md** §"📤 Post-merge actions" → sezione §"🔄 Lazy-state aggregation (D.24.x)" aggiornata
- **PR #19** (`feat/7-pwa-and-service-worker`) — primo caso sintomatico
- **17-DEV-NOTES.md** P10 (nuovo) — lessons stabilizzate per future migration
