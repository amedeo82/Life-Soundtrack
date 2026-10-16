# 🎵 Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## ✨ Cosa fa

- Importa la cronologia di ascolto da Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
- Arricchisce i dati con audio features (valence, energy, danceability, BPM)
- Ricostruisce la tua vita musicale in **ere**, **mood**, **eventi**, **ricordi**
- Ti permette di rivivere i periodi della tua vita attraverso la loro colonna sonora
- **Tutto resta sul tuo dispositivo**: elaborazione locale, privacy-first, GDPR-compliant

## 🏗️ Stato del progetto

**Fase 0 tecnica avviata** (2026-10-16). Il monorepo esiste ed è operativo; le feature di prodotto arriveranno con le story 0.2+.

**Cosa c'è oggi** (branch `feat/0.1-monorepo-setup`):
- Monorepo Turborepo: `apps/web` (@ls/web), `packages/core` (@ls/core), `packages/ui` (@ls/ui), `packages/config` (@ls/config)
- Toolchain: pnpm 9, Node 20+, TypeScript 5.6+, ESLint 9, Prettier 3, Vitest 3, Playwright 1.49+
- CI GitHub Actions (lint + typecheck + test + build)
- Scaffold minimo: Logger in `@ls/core`, PlatformId enum, componente Button in `@ls/ui`, App skeleton in `@ls/web`
- Documentazione completa + spec per tutte le story 0.2-6.1

**Prossima sbloccata**: Story 0.2 (Schema DB Dexie) — vedi `docs/11-BACKLOG.md`.

**Storico**:
- S0-S9: progettazione completa (audit 2026-10-15 chiude 9 incongruenze critiche + 13 medie)
- S10: policy versioni toolchain (D.10.1/D.10.2, upgrade a fine implementazione)
- S11: implementazione Story 0.1 (scaffold monorepo + toolchain), 8 problemi risolti documentati in `18-DEV-LOG.md`

- Documentazione: [`docs/INDEX.md`](docs/INDEX.md)
- Protocollo agenti: [`AGENTS.md`](AGENTS.md)
- Visione: [`docs/00-VISION.md`](docs/00-VISION.md)
- Backlog: [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)
- Diario implementazione: [`docs/18-DEV-LOG.md`](docs/18-DEV-LOG.md)
- Note sviluppo: [`docs/17-DEV-NOTES.md`](docs/17-DEV-NOTES.md)

## 🤝 Come contribuire

Questo progetto è attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file, poi segui l'ordine di lettura lì indicato. Per dettagli sull'implementazione corrente, leggi `docs/17-DEV-NOTES.md` (pitfalls consolidati) e `docs/18-DEV-LOG.md` (registro cronologico per story).

## 📜 Licenza

[Apache-2.0](LICENSE) — vedi decisione D.A.10 dell'audit del 2026-10-15. Open-source puro, nessuna monetizzazione (D.A.9).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*
