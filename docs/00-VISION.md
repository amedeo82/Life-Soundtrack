# 00 — Visione e Missione

> Status: 🟡 DRAFT
> Versione: 0.3
> Ultima modifica: Sessione 85 (2026-11-02)
> Responsabile: Boss

---

## 🎯 Il Problema

Le piattaforme di streaming musicale raccolgono **una quantità enorme di dati intimi** su ogni utente: cosa ascolta, quando, dove, da quale dispositivo, per quanto tempo, se salta i brani, se usa lo shuffle. Eppure, tutto quello che restituiscono è un **"Wrapped" annuale** con 5 artisti e 5 brani.

È come avere un diario segreto di 10 anni e usarlo solo per contare quante volte hai scritto la parola "ciao".

I dati esistono già. Quello che manca è un **lettore** che li trasformi in una storia.

## 💡 La Soluzione

**Life Soundtrack** è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming in un **diario di vita musicale**: una timeline personale, emotiva e contestuale che racconta la storia dell'utente attraverso la musica.

Non è un'app di statistica. È un'app di **narrazione autobiografica** basata sui dati di ascolto.

## 🧭 Principi Fondamentali

| Principio | Significato | Implicazione tecnica |
|-----------|-------------|---------------------|
| **Privacy-first** | I dati restano sul dispositivo dell'utente | Elaborazione in-browser, IndexedDB, nessun server centrale obbligatorio |
| **Local-first** | L'app funziona offline dopo il primo caricamento | PWA con service worker, dati locali |
| **Open data** | L'utente è proprietario dei propri dati | Export JSON in qualsiasi momento, portabilità GDPR |
| **Estensibilità** | Aggiungere una piattaforma non richiede modifiche al core | Adapter pattern, formato dati unificato |
| **Nessun lock-in** | Nessun abbonamento forzato, nessun dato ostaggio | Nessuna autenticazione obbligatoria, sync cloud opzionale e cifrato |
| **Narrazione prima dei numeri** | I dati raccontano storie, non statistiche | Insight in linguaggio naturale, non solo grafici |

## 🎬 Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

## 👥 Target Utenti

| Segmento | Età | Bisogno | Messaggio |
|----------|-----|---------|-----------|
| **Nostalgici** | 25-45 | Rivivere periodi della vita | "Che musica ascoltavi quando ti sei laureato?" |
| **Quantified Self** | 25-50 | Pattern e statistiche profonde | "Guarda l'evoluzione del tuo umore attraverso la musica" |
| **Audiofili** | 30-55 | Unificare sorgenti diverse | "Spotify + Qobuz + Plex, un'unica storia" |
| **Curiosi** | 20-40 | Andare oltre il Wrapped | "5 canzoni non bastano a raccontare il tuo anno" |
| **Privacy-conscious** | 25-50 | Controllo totale dei dati | "I tuoi dati, solo tuoi" |

## 🌍 Perimetro Iniziale (MVP)

- **Piattaforme supportate (Europa)**: Spotify, YouTube Music, Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz
  - *Allo stato del repository (Sessione 85) sono **implementate e importabili 5** fonti: Spotify, YouTube Music, Apple Music, ListenBrainz, Last.fm. Deezer, Tidal e SoundCloud restano nel perimetro ma **fuori** finché non c'è domanda reale — vedi `docs/22-COMPETITIVE-POSITIONING.md` §8 e `docs/01-PLATFORMS.md` §3.4-3.6*
- **Piattaforma di distribuzione**: PWA (web app installabile)
- **Modalità operativa**: Local-first, elaborazione in-browser
- **Lingue MVP**: Italiano, Inglese
- **Modello di business**: Open-source puro, nessuna monetizzazione (donazioni opzionali) — vedi D.A.9

## 🚫 Cosa NON è Life Soundtrack

- Non è un clone di Spotify Wrapped
- Non è una piattaforma di streaming
- Non è un social network musicale
- Non è un'app di raccomandazione
- Non è uno strumento per artisti/label (fuori scope per ora)
- **Non è un tracker di statistiche (Last.fm)**: un tracker conta e socializza i tuoi ascolti; noi li usiamo per scrivere un diario. È la distinzione da mettere per prima nel README
- **Non è un servizio cloud**: nessun account obbligatorio, nessun backend, nessun lock-in. L'unica uscita di rete è l'invio ai hub di scrobbling, **solo** se l'utente lo attiva hub per hub
- **Non è un diario manuale**: l'utente non deve annotare nulla durante l'ascolto; le storie nascono da anni di dati già esistenti

## 🎁 Cosa offre di unico

1. **Timeline narrativa**: non solo "hai ascoltato X", ma "in quel periodo della tua vita..."
2. **Unificazione multi-sorgente**: la storia completa attraverso tutte le piattaforme usate
3. **Rilevamento ere musicali ed eventi**: pattern e anomalie che raccontano capitoli della vita
4. **Ricordi tipo "Facebook Memories"**: ma basati sulla musica, non sulle foto
5. **Privacy come valore**: i dati non escono mai dal dispositivo

> **Stato reale dei cinque punti**: la verifica del 2026-11-02 (Sessione 85) ha distinto ciò che è **vero nel codice** da ciò che è **promesso**: la privacy locale e l'unificazione multi-sorgente sono reali; i motori di analisi (mood, ere, eventi, ricordi) e la pipeline audio sono **scritti e testati in core, ma non ancora collegati all'app** — quindi non ancora visibili all'utente. La tabella completa, con evidenze e gap, è in [`docs/22-COMPETITIVE-POSITIONING.md`](22-COMPETITIVE-POSITIONING.md) §4; il collegamento è la Story **2.5**.

## 📈 Metriche di Successo

- **Attivazione**: % di utenti che completano l'import
- **Retention settimanale**: % che apre l'app almeno 1 volta a settimana
- **Engagement con ricordi**: % di ricordi visti / condivisi
- **NPS**: soddisfazione percepita

## 🧭 Decisioni Strategiche (risolte in audit 2026-10-15)

| Decisione | Esito | Rif. |
|-----------|-------|------|
| Modello di business | ✅ Open-source puro, nessuna monetizzazione | D.A.9 |
| Licenza | ✅ **AGPL-3.0** (con patent grant non applicabile: AGPL-3.0) — ratificata dal project owner il 2026-10-30 (issue #201), D-AF.2 in `21-AUDIO-FEATURES.md` §2.4 | D.A.10 (superata) / D-AF.2 |
| Self-hosting supportato | ✅ Solo self-hosting con docs curata; istanza demo gratuita eventuale in Fase 2 | D.A.11 |
| Sync cloud | ✅ Previsto come servizio self-hosted in Fase 2 (mai SaaS); ADR-0005 con E2EE + consenso granulare + opt-in per categoria | D.A.12 |
| Cloud sync (implementazione MVP) | ✅ Placeholder in `05`, ADR-0005 da scrivere prima dell'implementazione | D.A.7 |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Bozza iniziale, consolidata dal lavoro esplorativo |
| 0.2 | Sessione 9 (2026-10-15) | Audit: chiuse tutte le decisioni strategiche aperte (D.A.9-12). Aggiornato modello di business |
| 0.3 | Sessione 85 (2026-11-02) | Posizionamento competitivo: rimando a `22-COMPETITIVE-POSITIONING.md`; "Cosa NON è" esteso (non un tracker, non un servizio cloud, non un diario manuale); stato reale dei cinque differenziatori (quello che è **vero nel codice** vs quello che è solo promesso); **licenza allineata ad AGPL-3.0** (la riga dichiarava ancora Apache-2.0, D.A.10 superata da D-AF.2, issue #201); perimetro MVP: 5 fonti implementate su 8 dichiarate |

---

*Questo documento è DRAFT. Diventa vincolante per gli agenti solo dopo approvazione di Boss (status: 🟢 APPROVED).*
