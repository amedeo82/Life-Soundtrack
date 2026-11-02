# 22 — Posizionamento competitivo e priorità di prodotto

> Status: 🟡 DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 85 (2026-11-02)
> Responsabile: Boss
> Fonte: analisi competitiva del 2026-11-02 (confronto con Last.fm/VinVibe, Remi/Music Memory, Spotify Wrapped) verificata **riga per riga contro il codice** del repository

---

## 🎯 Perché questo documento

Il progetto aveva la visione (`00-VISION.md`) e il backlog (`11-BACKLOG.md`), ma **nessun documento che rispondesse a tre domande**:

1. **Chi siamo e chi non siamo** — perché un lettore del README deve capire in tre secondi che Life Soundtrack non è "un altro scrobbler".
2. **Quale è il nosto vantaggio reale** — cioè quale differenziatore è **vero nel codice oggi** e quale è solo una promessa.
3. **In che ordine costruiamo il resto** — la sequenza delle 7 story rimanenti, motivata dal valore per l'utente e non dall'ordine delle issue su GitHub.

Questo documento è la sede di quelle tre risposte. È **proposta, non vincolante**: le decisioni che richiedono un atto del project owner sono elencate in §16.

## 🔍 Metodo e regola di onestà

Due regole, applicate a tutto il documento:

| Regola | Cosa significa |
|--------|---------------|
| **R1 — Ogni claim sul *nostro* prodotto è verificato sul codice** | Un differenziatore si dichiara **solo** se c'è il codice che lo realizza. Se c'è la spec ma non l'implementazione, si dichiara «specificato, non realizzato». |
| **R2 — I claim sui *competitor* sono da fonte esterna** | L'analisi del 2026-11-02 descrive i competitor da fonti non verificate in modo indipendente: sono **ipotesi di mercato**, utili per il posizionamento, non fatti verificabili in questo repository. |

File verificati per la verifica del nostro prodotto: `apps/web/src/onboarding/OnboardingRouter.tsx`, `apps/web/src/screens/`, `apps/web/src/components/`, `packages/core/src/db/`, `packages/core/src/analysis/`, `packages/core/src/enrichment/`, `packages/core/src/adapters/`, `packages/core/src/schema/index.ts`, `packages/core/package.json`, `apps/web/package.json`.

## 🕳️ Il vuoto di mercato che copriamo

> I tracker fanno dati senza emozioni. I diari fanno emozioni senza dati storici. Il Wrapped fa emozioni storiche ma effimere e chiuse. Noi uniamo **dati storici + emozioni + privacy + persistenza**.

È la posizione giusta per il progetto, ed è coerente con i principi già dichiarati in `00-VISION.md` §"Il Problema" (il "Wrapped annuale con 5 artisti e 5 brani" è esattamente il limite che `00` si rifiuta di accettare).

## 🧭 I quattro differenziatori, verificati contro il codice

L'analisi competitiva ne dichiara quattro. **Solo uno è pienamente vero nel codice oggi**: gli altri due sono veri *a livello di architettura* (i mattoni ci sono, l'edificio non è montato) e uno è vero ma con una precisazione necessaria.

| # | Differenziatore dichiarato | Stato reale | Evidenza nel codice | Il gap |
|---|--------------------------|-------------|---------------------|--------|
| 1 | **Privacy-first locale**: tutto resta sul dispositivo | 🟢 **Vero, con una precisazione** | `packages/core/src/db/db.ts` (Dexie/IndexedDB, 15 tabelle, nessun backend in tutto il repo); l'unico codice di rete è (a) il consenso **per-hub** di scrobbling (`packages/core/src/adapters/scrobble/`), (b) i proxy/API che l'utente configura lui, (c) `GET /version.json` same-origin | «Tutto resta sul dispositivo» è vero **a riposo**: l'uscita esiste solo per l'invio ai hub che l'utente ha abilitato uno per uno (`PrivacySettings.scrobbleHubs`, default `[]`). Va detto con le parole giuste, non assolutizzato |
| 2 | **Multi-piattaforma unificata**: 5 fonti in una timeline sola | 🟢 **Vero** | `ACTIVE_PLATFORMS` = Spotify, YouTube Music, Apple Music, ListenBrainz, Last.fm (`apps/web/src/onboarding/OnboardingRouter.tsx`), con una factory e una classe adapter per ciascuna in `packages/core/src/adapters/`; deduplication unificata (`canonicalKey`, `rekey()`) | Nessuno sul perimetro dichiarato: Deezer, Tidal e SoundCloud restano **fuori** (`01-PLATFORMS.md` §3.4-3.6) |
| 3 | **Retrospettiva storica**: anni di dati grezzi diventano narrazione | 🟡 **Architettura vera, prodotto non ancora** | I quattro motori esistono e sono testati: mood (`analysis/mood/`), ere (`analysis/era/`), eventi (`analysis/event/`), ricordi (`analysis/memory/`), con l'orchestratore in `analysis/pipeline.ts` e la persistenza degli insight in `db/insights.ts` | **Il motore non gira mai**: nessun codice in `apps/web` invoca `AnalysisPipeline`/`createMoodGenerator`/i generatori, e la Home legge gli insight (`useHomeTimelineData.ts`) che nessuno scrive. Dopo un import pulito le sezioni ere/mood/ricordi sono **vuote**. Manca il collegamento → **Story 2.5** |
| 4 | **Analisi acustica locale** (valence, energy, danceability, BPM) | 🟡 **Architettura vera, prodotto non ancora** | Il pacchetto `packages/core/src/enrichment/` è completo: porta `EssentiaEngine` con caricamento WASM **su richiesta**, cascata `cache → Essentia.js → AcousticBrainz → euristico`, normalizzazione DEAM, storage con TTL/LRU, limiti di rete (`21-AUDIO-FEATURES.md` v1.1 🟢) | La libreria **non è una dipendenza**: `essentia` non compare in nessun `package.json` né nel lockfile, il modulo WASM non viene mai caricato, il pacchetto non è importato da `apps/web` e l'euristico **non** alimenta il mood tracker (D-AF.4). Nessun utente vede oggi un valore acustico |

**Sintesi operativa**: i differenziatori 3 e 4 sono la **promessa** del progetto, non ancora il **prodotto**. Il gap non è negli algoritmi (sono scritti e testati) né nella privacy (è reale): è nel **collegamento** fra core e app, e nel **contenuto visivo** (l'artwork, che è anche il moltiplicatore di tutto il resto).

## ⚔️ Matrice dei competitor

La colonna Life Soundtrack riporta lo stato **verificato** (non quello dichiarato): è la differenza fra la promessa e la realtà del repository.

| Aspetto | Last.fm / VinVibe | Remi / Music Memory | Spotify Wrapped | **Life Soundtrack (stato verificato)** |
|---------|-------------------|---------------------|-----------------|--------------------------------------|
| Dati storici | Sì (solo statistiche) | No (solo presente) | Sì (annuale) | **Sì — timeline continua, 5 fonti** 🟢 |
| Narrazione emotiva | No | Sì (manuale) | Sì (effimera) | **Motori pronti, generazione non collegata** 🟡 |
| Multi-piattaforma | No | No | No | **Sì — 5 adapter** 🟢 |
| Privacy locale | No | No | No | **Sì — l'unico con i dati a riposo sul dispositivo** 🟢 |
| Analisi acustica | No | No | No | **Provider e cascata in core, non integrate** 🟡 |
| Open source | No | No | No | **Sì — AGPL-3.0** 🟢 |
| Condivisione | No | Limitata | Sì (forte) | **Non ancora** ⬚ (Story 3.2) |
| Copertine | Sì (ma sono un'icona, non un diario) | Sì | Sì | **Non ancora** ⬚ (Story 4.3) |

> La riga «Copertine» non è nella matrice dell'analisi: è stata aggiunta perché è **l'ancora visiva** del diario e oggi manca del tutto (il campo `artworkUrl` esiste nello schema, ma la pipeline di import scrive sempre `artworkUrl: null`).

## 🚫 Cosa non siamo

Da mettere nel README in prima persona singolare. Serve a evitare che un lettore pensi "un altro scrobbler":

- **Non siamo Last.fm**: Last.fm è un **tracker di statistiche**; noi siamo un **diario emotivo**. L'unico modo in cui ci assomigliamo è il flusso dati degli ascolti, e lo usiamo in modo opposto (i dati restano locali invece di alimentare un grafico sociale).
- **Non siamo Spotify Wrapped**: non un annuale effimero e chiuso, ma una **timeline continua** che cresce con gli anni.
- **Non siamo un diario manuale**: l'utente non deve scrivere nulla durante l'ascolto. Le nostre storie nascono da anni di dati grezzi **già esistenti**.
- **Non siamo un servizio cloud**: nessun account obbligatorio, nessun backend, nessun lock-in. L'utente è proprietario dei dati e può portarli via (Story 5.2).
- **Non siamo un social network**: nessun feed pubblico, nessun profilo, nessun like.
- **Non siamo una piattaforma di streaming** né uno strumento per artisti e label.

## 🔧 I due lavori che rendono veri i differenziatori 3 e 4

| Lavoro | Perché è abilitante | Story |
|--------|--------------------|-------|
| **Collegare il pipeline di analisi all'app** | Senza, gli utenti non vedono mai un'era, un umore o un ricordo: il diario esiste solo come codice. È il lavoro che trasforma «abbiamo gli algoritmi» in «l'app conosce la tua musica» | **Story 2.5** (nuova) |
| **Popolare l'artwork** | Le copertine sono l'ancora visiva: senza, la timeline è un elenco di testo e l'app resta uno strumento tecnico. È inoltre il **moltiplicatore** delle altre storie: il colore dominante dell'era, la card condivisibile e il mood condiviso nascono tutti dall'artwork | **Story 4.3** (priorità ricalcolata, vedi §8) |

In più, un terzo lavoro **piccolo e ad alto rendimento**: l'**onboarding deve mostrare la magia** (§9).

## 📌 Priorità ricalcolate

L'analisi competitiva propone un ordine diverso da quello implicito dal backlog. La tabella è la **proposta** (§16, D-22.3); il backlog ne riflette le conseguenze operative.

| Priorità | Cosa | Perché | Story |
|----------|------|--------|-------|
| 🔴 **P0** | **Collegamento del pipeline di analisi all'app** | È il differenziatore 3 ed è quello che l'utente percepisce per primo dopo l'import. Costa meno dell'artwork e sblocca l'uso reale di 4 story già scritte | 2.5 (nuova) |
| 🔴 **P0** | **Artwork enrichment** | L'ancora visiva; abilita era-colorata, card condivisibile e mood. **Non deve dipendere dal lookup MusicBrainz**: iTunes Search e Spotify coprono la maggior parte dei casi senza MBID | 4.3 |
| 🔴 **P0** | **Ricordi + Share** | Il motore virale. Il vincolo di privacy non è un blocco: si esporta un **capitolo statico** (immagine/HTML/PDF), non il database | 3.2 |
| 🔴 **P0** | **Esplora + Analisi** | L'"aha moment": la stessa analisi, ma raccontata in linguaggio naturale («A marzo 2023 hai ascoltato 47 canzoni malinconiche in due settimane») invece che solo in grafici | 3.3 |
| 🔴 **P0** (piccola) | **Anteprima e modalità demo in onboarding** | Il diario di esempio prima dell'import: costa poco e cambia la prima impressione dell'app | 3.5 |
| 🟡 **P1** | **Export e purge** | Se il valore principale è la privacy, «scarica il mio diario» e «cancella tutto» devono essere **prominenti**, non nascosti. È fiducia, non burocrazia | 5.2 |
| 🟡 **P1** | **Privacy spec finale + pagina in-app** | Una pagina «Come trattiamo i tuoi dati» chiara e onesta è sufficiente per il lancio | 5.1 |
| 🟢 **P2** | **Lookup MusicBrainz** | Utile per la precisione dei metadati, ma **non cambia l'esperienza** e non è un prerequisito dell'artwork | 4.2 |
| 🟢 **P2** | **Altre piattaforme** (Deezer, Tidal, SoundCloud) | Il mercato principale è coperto: si aggiungono **solo su domanda reale** | `01-PLATFORMS.md` §3.4-3.6 |
| ⚪ **P3** | **Upgrade toolchain** | Debito tecnico: dopo il lancio (D.10.2) | 6.1 |

> **Nota di metodo**: l'analisi esterna colloca «Esplora + Analisi» al livello dell'artwork e della condivisione. È d'accordo con la nostra lettura **solo se** la Story 3.3 produce **insight in prosa** e non solo grafici: un grafico in più non è un "aha moment", una frase che spiega un periodo lo è. La specifica di `3.3` va scritta con questo criterio.

## 🎩 L'onboarding deve mostrare la magia

L'analisi ha ragione: l'onboarding oggi non mostra il risultato. La schermata di reveal mostra un **contatore** di eventi e un anno cablato (`OnboardingRouter.tsx`, step ⑤), non un'anteprima del diario.

Il progetto ha già i mattoni: `fixtures/demo-user.json` (1 anno, 4500 eventi, 200 track, 30 artisti, `demoMode: true`) è previsto da `06-UX-FLOWS-STATES.md` §2.14 e la CTA «Scopri come funziona» esiste nelle stringhe i18n, ma **nessun file di codice li usa**.

Proposta (→ **Story 3.5**, nuova):

- la CTA «Scopri come funziona» **prima** dell'import, con un **diario di esempio** (dati sintetici, mai quelli dell'utente): timeline, un'era, una card;
- il reveal dell'import reale mostra **le prime tre righe** della timeline, non un contatore;
- zero modifiche al percorso dati reale: il demo scrive su un DB separato o non scrive affatto.

## 🏛️ Le ere sono il superpotere — e oggi sono solo una banda colorata

Il progetto ha il rilevamento delle ere (`analysis/era/`) e le mostra in Timeline (`components/EraBand.tsx`). Ma **un'era oggi non è un capitolo**:

| Cosa serve perché un'era sia un capitolo | Stato | Nota |
|--------------------------------------------|-------|------|
| Rilevamento automatico delle ere | 🟢 pronto | change point detection su firme settimanali (`04§5`) |
| Etichetta automatica (`Era {mood} {genere}`) | 🟢 pronto | `analysis/era/i18n.ts` |
| Colore della banda | 🟢 pronto | ma è il **colore del mood**, non un colore dominante dell'era |
| **Nome scelto dall'utente** («la mia era universitaria») | ⬚ mancante | lo schema prevede `Insight.userNote`, ma non c'è né UI né percorso di scrittura |
| **Colore dominante dell'era**, derivato dalle copertine | ⬚ mancante | dipende dall'artwork (Story 4.3) |
| **Canzone simbolo** | ⬚ mancante | esiste `topTrackIds` (le 5 più ascoltate), non un brano simbolo unico |
| **Tag manuali** («viaggio a Berlino», «esame di laurea») | ⬚ mancante | il tagging manuale è **il ponte** fra l'analisi automatica (che dice *cosa* suonava) e la verità dell'utente (che sa *perché*) |

Nota di privacy: il tagging manuale è **testo libero dell'utente**, resta sul dispositivo, ed è l'unico contenuto che l'app non può derivare. Va trattato come contenuto di primo livello (export, purge, cancellazione) nella Story 5.2.

## 📤 Condividere senza esporre il database

Il vincolo architetturale (tutto locale) **non** è un ostacolo alla condivisione: è la sua **forma corretta**. La condivisione non deve esportare il database, deve esportare **un capitolo**.

Proposta per la Story 3.2 (→ spec da scrivere):

- **«Genera la cartolina del ricordo»**: un'immagine (canvas 1080×1350, già previsto dagli AC della 3.2) con copertine, periodo, canzone simbolo, nome dell'era;
- **export statico** (immagine, HTML autonomo, PDF) — niente JSON del database nei canali di condivisione;
- Web Share API per la condivisione nativa, con fallback download (gli AC della 3.2 lo prevedono già);
- la **privacy resta il messaggio**: la card dice «la mia estate 2019 su Life Soundtrack» e non contiene dati identificativi.

L'export **completo** del database (portabilità GDPR) resta un'altra cosa, e sta nella Story 5.2.

## 🔐 Export e purge: la privacy come atto di fiducia

La priorità media dell'analisi è giusta, e per un motivo preciso: **`Promise` che l'utente non può eseguire non è una promessa**. Con il valore principale dichiarato (privacy locale), due pulsanti devono essere **prominenti** — «Scarica il mio diario» (JSON/CSV) e «Cancella tutto» (doppia conferma) — non una voce in un menu di manutenzione.

Stato reale oggi: esistono i primi mattoni (`purgeIp()`, `purgeScrobbleQueue()`, `rekey()`, `orphanCleanup()`, `recount()`) e le stringhe i18n (`settings.data.export`, `settings.data.delete`), ma **nessun flusso completo**: il pannello `MaintenancePanel.tsx` non è montato da nessuna parte e i pulsanti sono placeholder. La Story 5.2 è dunque il **primo atto di privacy che l'utente può compiere**, non un dettaglio tecnico.

## 📄 Privacy spec e pagina «Come trattiamo i tuoi dati»

Per il lancio non serve un documento legale monumentale: serve una **pagina in-app** chiara e onesta (la Story 5.1), che dica:

- cosa resta sul dispositivo e cosa non esce mai;
- l'unica eccezione: l'invio ai hub di scrobbling **solo** se l'utente ha attivato quel hub (default: nessuno);
- cosa succede ai dati quando l'utente li esporta o li cancella;
- che il progetto è AGPL-3.0 e offre il sorgente (§13).

La pagina utente è il **documento** (§5.1) tradotto in linguaggio semplice; la specifica `09-PRIVACY-SECURITY.md` resta il documento tecnico.

## ⚖️ La licenza AGPL-3.0: risposta alla domanda aperta

L'analisi chiede: «AGPL va bene?». **La domanda è già stata chiusa** e la risposta è nel repository:

| Decisione | Esito | Riferimento |
|-----------|-------|------------|
| Licenza | **AGPL-3.0**, non Apache-2.0 | D-AF.2 (`21-AUDIO-FEATURES.md` §2.4), ratificata dal project owner il 2026-10-30 (issue #201) |
| Modello di business | Open-source puro, nessuna monetizzazione | D.A.9 (`00-VISION.md`) |
| Obbligo §13 (offerta del sorgente) | **Implementato**: schermata About con licenza, testo dell'offerta e link al repository; file `NOTICE` | issue #202 |

Il limite che l'analisi segnala — i fork commerciali devono rilasciare il sorgente — è **accettato di proposito**: è il prezzo della coerenza fra la licenza di `essentia.js` e la distribuzione della PWA, e il progetto non ha un modello di ricavi da proteggere. Nessuna modifica alla licenza è proposta.

Una **correzzione necessaria**: `00-VISION.md` dichiarava ancora **Apache-2.0** (decisione D.A.10, mai aggiornata dopo la ratifica AGPL). È un drift dichiarativo: il file è stato corretto in questa sessione.

## 🚫 Cosa NON cambiare

- **Non aggiungere piattaforme per ipotesi**: Deezer, Tidal e SoundCloud restano in roadmap finché non c'è domanda reale (il mercato principale è coperto da 5 fonti).
- **Non fare dipendere l'artwork dal lookup MusicBrainz**: la Story 4.3 ha oggi `[DEP:4.2]`, ma la cascata prevista funziona senza MBID (Spotify Web API → iTunes Search → placeholder; MB Cover Art solo se esiste un MBID). Il vincolo è stato allentato (§16, D-22.4).
- **Non costruire un backend**: nessuna delle story proposte qui richiede un server. Il progetto resta senza backend per costruzione, non per ostacolo.
- **Non trasformare l'app in un social**: la condivisione resta **a valle** di un export statico, senza account e senza feed.

## 🧾 Decisioni proposte al project owner

| # | Decisione proposta | Motivazione | Impatto |
|---|--------------------|-------------|---------|
| **D-22.1** | Adottare `docs/22-COMPETITIVE-POSITIONING.md` come sede del posizionamento competitivo | Non esisteva un documento che rispondesse a «cosa non siamo» e «quale vantaggio è vero» | `00-VISION.md` e `README.md` rimandano qui |
| **D-22.2** | Le storie **2.5** (collegamento del pipeline di analisi all'app) e **3.5** (anteprima/demo in onboarding) entrano nel backlog | Sono i due lavori che rendono visibili i differenziatori 3 e 4, e l'onboarding che deve mostrare la magia | Il catalogo passa da 28 a 30 story; l'indicatore di avanzamento si riallinea (denominatore +2, gate «motore di analisi completo» torna non soddisfatto, che è vero) |
| **D-22.3** | L'ordine di lavorazione diventa **2.5 → 4.3 → 3.2 → 3.3 → 3.5 → 5.2 → 5.1 → 4.2 → 6.1** | L'ordine dell'analisi esterna è corretto sul valore, con due correzioni: l'artwork non dipende più dal lookup MusicBrainz, e l'anteprima in onboarding (3.5) è un lavoro piccolo ad alto rendimento | `11-BACKLOG.md` §"Priorità di lavorazione" |
| **D-22.4** | La **Story 4.3** non ha più `[DEP:4.2]`; il lookup MusicBrainz diventa un **miglioramento incrementale** del catalogo | L'artwork è l'ancora visiva e non deve attendere un lookup che non cambia l'esperienza | `11-BACKLOG.md` §Story 4.3 |
| **D-22.5** | Il **tagging manuale** di ere e canzoni è parte della Story **3.2** (non delle 5.1/5.2) | È il ponte fra analisi automatica e autobiografia; vive con l'esperienza dell'era, e i suoi dati (testo libero) sono coperti dall'export/purge della 5.2 | `11-BACKLOG.md` §Story 3.2 |
| **D-22.6** | Il **README** dichiara le capability solo dove sono vere: ciò che è pronto in `@ls/core` ma **non ancora eseguito dall'app** (motori di analisi, pipeline audio) resta nella sezione «Roadmap», con la dicitura esatta («scritti e testati in `@ls/core`, ma non ancora eseguiti dall'app»); la sezione «Cosa c'è oggi» non promette nulla che il codice non faccia | Il gate `check-readme-facts.mjs` confronta la prosa con il codice: dichiarare come presente ciò che non lo è è drift, ed è il drift che il gate è nato per chiudere (issue #161). Lo stesso vale per «anteprima del risultato» e «purga del database», che il README dichiarava e il codice non ha | `README.md` |
| **D-22.7** | La pagina «Come trattiamo i tuoi dati» è un AC della Story **5.1** | Il valore è la privacy: la promessa deve essere leggibile dall'utente, non solo nel documento tecnico | `11-BACKLOG.md` §Story 5.1 |
| **D-22.8** | Le 7 story rimanenti ricevono un **pacchetto di specifiche implementabili** (`23`–`27`), scritte nella Sessione 86 | Una story senza specificazione non è lavorabile: il protocollo richiede una spec 🟢 APPROVED. Le specifiche sono state scritte **contro il codice reale** (contratti, file, indici, nomi di chiave i18n, vincoli di privacy), così la sessione di coding non deve re-interpretare il backlog | `docs/23-…` … `docs/27-…` |

## 🔀 Mappa: dall'analisi al backlog

| Elemento dell'analisi (2026-11-02) | Destinazione | Stato |
|----------------------------------------|-------------|-------|
| «Artwork enrichment prima di MusicBrainz» | Story 4.3 (priorità P0, `[DEP:4.2]` allentato) | ✅ riflesso |
| «Ricordi + Share, con export statico» | Story 3.2 (§10, §11 di questo documento) | ✅ riflesso |
| «Esplora + Analisi: insight in prosa» | Story 3.3 (§8, nota di metodo) | ✅ riflesso |
| «Export e purge prominenti» | Story 5.2 (§12) | ✅ riflesso |
| «Privacy spec e pagina in-app» | Story 5.1 (§13, D-22.7) | ✅ riflesso |
| «MusicBrainz a bassa priorità» | Story 4.2 → P2 (§8) | ✅ riflesso |
| «Altre piattaforme solo su domanda» | §15 + `01-PLATFORMS.md` §3.4-3.6 | ✅ riflesso |
| «Upgrade toolchain a bassa priorità» | Story 6.1 → P3 (§8) | ✅ riflesso |
| «L'onboarding deve mostrare la magia» | **Story 3.5** (nuova, §9) | ✅ riflesso |
| «Il differenziatore acustico ed emotivo è reale» | **Story 2.5** (nuova, §7) | ✅ riflesso |
| «Le ere devono essere visuali e personalizzabili» | §10 (nome, colore dominante, canzone simbolo, tag) | ✅ riflesso |
| «Il tagging manuale è il ponte» | Story 3.2 (D-22.5) | ✅ riflesso |
| «Dichiara cosa non siamo (non Last.fm)» | §6 + `README.md` §"Cosa non siamo" + `00-VISION.md` | ✅ riflesso |
| «La licenza AGPL: pro e contro» | §14 (decisione già chiusa, nessuna modifica) | ✅ riflesso |
| «Ogni lacuna deve essere implementabile in una sessione di coding» | **Pacchetto di specifiche `23`–`27`** (Sessione 86, D-22.8): una spec per ogni story, scritta contro il codice reale | ✅ riflesso |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 85 (2026-11-02) | Prima stesura: posizionamento competitivo verificato contro il codice, matrice dei competitor con lo stato reale, "cosa non siamo", differenziatori 1-4 con i gap dichiarati, priorità ricalcolate, D-22.1…D-22.7 |
| 0.2 | Sessione 86 (2026-11-02) | Aggiunta **D-22.8**: le 7 story rimanenti ricevono il pacchetto di specifiche implementabili `23`–`27` |

---

*Questo documento è DRAFT. Le decisioni in §16 sono proposte e diventano vincolanti per gli agenti solo dopo approvazione di Boss.*
