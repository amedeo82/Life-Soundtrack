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

---

## Schema frontmatter

### `state/sessions/<N>-<slug>.md`

```markdown
---
number: 22                          # numero sessione (intero)
title: "..."                         # titolo breve della sessione
date: 2026-10-18                     # data ISO
state: 🟡 | 🟢                       # stato post-esito: 🟡 = merge pendente, 🟢 = chiusa
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
| `state/stories/0.5-pwa.md` | ✅ migrata | da Story 0.5 BACKLOG + 18-DEV-LOG §11 |
| `state/stories/0.6-i18n.md` | ✅ migrata | da Story 0.6 BACKLOG + 18-DEV-LOG §12 |
| Sessioni 0..21 | ⬚ TODO (migration incrementale) | restano in `docs/SESSIONS.md` legacy fino a V2 |
| Stories 0.1..0.4, 0.7+ | ⬚ TODO (migration incrementale) | restano in `docs/11-BACKLOG.md` legacy fino a V2 |

Vedi ADR-0008 §"Piano di rollout" per la migration V2 (futuro).

---

## Riferimenti

- **ADR-0008** (`docs/13-ADR/0008-lazy-state-aggregation.md`) 🟢 APPROVED — spec completa
- **Issue #24** — contenitore del lavoro, claim `kilo-HP-ELITEBOOK-hjoe`
- **AGENTS.md** §"📤 Post-merge actions" → sezione §"🔄 Lazy-state aggregation (D.24.x)" aggiornata
- **PR #19** (`feat/7-pwa-and-service-worker`) — primo caso sintomatico
- **17-DEV-NOTES.md** P10 (nuovo) — lessons stabilizzate per future migration
