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

EPIC 0 (Fase 0 tecnica) è completo 7/7: monorepo + toolchain + schema DB + adapter Spotify + UI import + PWA + i18n + operations runbook. Lo **stato globale** corrente è gestito dai blocchi aggregati di `docs/INDEX.md` (`<!-- AGGREGATE-INDEX-STATUS-* -->`) e di `docs/11-BACKLOG.md` (`<!-- AGGREGATE-STORIES-* -->`) — quelli, e non questo README, sono la **fonte di verità** per `status`, conteggi e roadmap. La sezione `11-BACKLOG.md` §"Stato di avanzamento — roadmap delle story non ancora completate" elenca cosa manca.

### Prossima story

<!-- AGGREGATE-NEXT-STEP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V3, ADR-0008, issue #127).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Prossima story da implementare**: **1.3** — Adapter Last.fm + ListenBrainz (priority `I`, vedi `docs/11-BACKLOG.md`).

Sorgente: `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md`. Issue candidabile: filtra con `gh issue list --label agent-ready --state open` (vedi `docs/11-BACKLOG.md` §"Priorità di lavorazione per agenti").

<!-- AGGREGATE-NEXT-STEP-END -->

- Documentazione: [`docs/INDEX.md`](docs/INDEX.md)
- Protocollo agenti: [`AGENTS.md`](AGENTS.md)
- Visione: [`docs/00-VISION.md`](docs/00-VISION.md)
- Backlog: [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)
- Diario implementazione: [`docs/18-DEV-LOG.md`](docs/18-DEV-LOG.md)
- Note sviluppo: [`docs/17-DEV-NOTES.md`](docs/17-DEV-NOTES.md)

## 🤝 Come contribuire

Questo progetto è attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file, poi segui l'ordine di lettura lì indicato. Per dettagli sull'implementazione corrente, leggi `docs/17-DEV-NOTES.md` (pitfalls consolidati) e `docs/18-DEV-LOG.md` (registro cronologico per story).

> ⚠️ **PowerShell 5.1 (Windows senza `pwsh`)**: i gate `scripts/*.ps1 -Check` richiedono il **singolo trattino**. `--check` esce 2 a partire da issue #104; vedi `docs/12-DEVOPS.md §9.7b`.

## 📜 Licenza

[Apache-2.0](LICENSE) — vedi decisione D.A.10 dell'audit del 2026-10-15. Open-source puro, nessuna monetizzazione (D.A.9).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*
