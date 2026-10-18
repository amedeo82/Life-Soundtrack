---
number: 22
title: "📱 Implementazione Story 0.5 (PWA e service worker)"
date: 2026-10-18
state: 🟢
branch: feat/7-pwa-and-service-worker
pr: 19
issue: 7
merged_commit: 0ebe8da
merged_date: 2026-10-18T15:29:28Z
claim: kilo-HP-ELITEBOOK-3b3f
---

## Sintesi

Prima implementazione di una PWA reale del progetto (vite-plugin-pwa@^2.0.0 + Workbox + manifest + icone PNG zero-deps + hook `useAppUpdate()` + componente `<UpdateBanner>`). 33/33 test verdi, bundle 227.81 KB gzip 71.36 KB (budget 300 KB ✅). PR #19 aperta ma in CONFLICTING ricorrenti con `main` (5 conflitti doc) a causa dei merge successivi di PR #21 (S23) e PR #22 (S24) che hanno toccato gli stessi file di stato INDEX/SESSIONS/BACKLOG/BUNDLE — è esattamente il sintomo che motivano `state/`.

## Claim

- Claim `kilo-HP-ELITEBOOK-3b3f` (UTC 2026-10-18T08:30:15Z) su issue #7
- Comment ID GitHub `6247654703`, vincitore per unanimità (un solo claim)
- Push early `feat/7-pwa-and-service-worker` (D.20.2)

## Decisioni (D.22.1-D.22.6)

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.22.1 | `registerType: 'prompt'` (NON `'autoUpdate'`) | L'utente deve poter scegliere quando applicare un update (spec §11.3) |
| D.22.2 | NetworkFirst con TTL 5min per `/version.json` (NON CacheFirst) | Versione server letta regolarmente; fallback cache se offline |
| D.22.3 | Mock `virtual:pwa-register/react` via `resolve.alias` | Modulo virtuale di Vite plugin esiste a build-time; jsdom non lo conosce |
| D.22.4 | Cleanup esplicito via `test-setup.ts` con `afterEach(cleanup)` | `vitestBase` ha `globals: false`, auto-cleanup RTL non scatta |
| D.22.5 | PNG generator zero-deps con `node:zlib` | Lighthouse richiede PNG (SVG non passa); non serve sharp/resvg/pngjs |
| D.22.6 | CSS inline per `<UpdateBanner>` invece di importare `@ls/ui` | Tokens arriveranno con Story 3.1; inline evita dipendenza circolare |

## Lesson learned

- **race condition** nel workflow multi-agente (doc-sync IN PR causa conflitti su 5+ file condivisi) → motivazione per ADR-0008 (lazy-state aggregation)
- `registerType: 'prompt'` è la scelta giusta per app con migrazione DB: `'autoUpdate'` può lasciare l'utente su cache buggata
- L'alias `resolve.alias` in `vite.config.ts` è preferibile a `vi.mock` globale per moduli virtuali di plugin Vite

## Documenti aggiornati (doc-sync IN PR, D.21.1)

- `docs/11-BACKLOG.md` → v1.5.0 (Story 0.5 task ✅ + AC ✅, changelog)
- `docs/18-DEV-LOG.md` → v1.3 (§11 entry Story 0.5 con 5 lesson 0.5-1..5)
- `docs/INDEX.md` → §"Stato del progetto" aggiornata
- `docs/SESSIONS.md` → questa entry + changelog v1.6
- `docs/BUNDLE.md` → rigenerato (auto-regen via `pre-push` hook D4)
- `scripts/generate-bundle.ps1` → `$files` include `scripts/generate-pwa-icons.mjs`
- `apps/web/src/App.tsx` → mostra `<UpdateBanner>` quando `needRefresh`
