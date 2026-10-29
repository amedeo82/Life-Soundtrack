# 09 — Privacy & Security

> Status: 🟡 DRAFT · Versione 0.6 · Sessione 62 (2026-10-28)
> ⚠️ **AVVISO**: Questo documento è una bozza tecnica-legale. La privacy policy
> (§7) DEVE essere revisionata da un professionista legale qualificato prima
> del lancio pubblico. Questo documento non costituisce consulenza legale.

---

## 1. Scopo e scope

Definire:
- Il flusso completo dei dati personali nell'applicazione
- Le basi giuridiche GDPR per ogni trattamento
- Come i diritti dell'utente sono implementati tecnicamente
- Il testo della privacy policy pubblica
- I disclaimer per le inferenze psicologiche
- Le note trademark per i loghi di terze parti
- Il threat model e le mitigazioni
- La checklist di compliance pre-lancio

## 2. Principi privacy (richiamo ADR-0002)

| Principio | Implementazione |
|-----------|-----------------|
| **Local-first** | Tutti i dati in IndexedDB del browser; nessun server centrale |
| **Minimizzazione** | Solo i campi necessari; IP scartato di default |
| **Trasparenza** | Ogni toggle spiega cosa fa; data flow pubblico in questo doc |
| **Reversibilità** | Export e cancellazione totale sono operazioni locali e immediate |
| **Privacy by default** | Tutti i toggle privacy sono OFF di default |

## 3. Data flow diagram

### 3.1 Flusso dei dati

    ┌─────────────────────────────────────────────────────────────┐
    │                     DISPOSITIVO UTENTE                      │
    │                                                             │
    │  [File export piattaforma]                                  │
    │         │                                                   │
    │         ▼                                                   │
    │  [Adapter: parse + normalizza]                              │
    │         │                                                   │
    │         ├──▶ IP? ──NO──▶ scartato dopo derivazione country  │
    │         │      │                                            │
    │         │      └─SÌ (toggle retainIp ON)──▶ IndexedDB       │
    │         │                                                   │
    │         ▼                                                   │
    │  [IndexedDB: listens, tracks, artists, ...]                 │
    │         │                                                   │
    │         ▼                                                   │
    │  [Analysis Engine (Web Worker, locale)]                     │
    │         │                                                   │
    │         ▼                                                   │
    │  [Insights: mood, ere, eventi, ricordi]                     │
    │         │                                                   │
    │         ▼                                                   │
    │  [UI: timeline, ricordi, analisi]                           │
    │                                                             │
     └─────────────────────────────────────────────────────────────┘

**Nota (opzione A, issue #108)**: il `country` è derivato dall'IP e conservato **indipendentemente dal toggle `retainIp`** (`02` §3.8): anche quando l'IP viene scartato (`retainIp = false`), il paese resta nel DB locale come dato derivato non identificativo. Il consenso esplicito è richiesto solo per la ritenuta dell'indirizzo IP stesso.

                           │ SOLO se toggle specifici ON:
                           ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    RETE (opzionale)                         │
    │                                                             │
    │  [toggle enrichMetadata ON]                                 │
    │     └─▶ MusicBrainz / iTunes Search / AcousticBrainz:       │
    │        invia SOLO nome brano + artista (o il solo MBID)     │
    │         (nessun dato utente, nessun timestamp)              │
    │                                                             │
    │         L'anteprima audio di 30 s di iTunes Search          │
    │         viene SCARICATA e analizzata in locale:             │
    │         l'audio non esce e non viene scritto su disco       │
    │                                                             │
    │  [scrobbleHubs configurato]                                 │
    │     └─▶ Last.fm / ListenBrainz: invia brano + timestamp     │
    │         (scelta esplicita dell'utente, servizio terzo)      │
    │                                                             │
    │  [toggle syncCloud ON — Fase 2]                             │
    │     └─▶ Server E2E encrypted: ciphertext only               │
    └─────────────────────────────────────────────────────────────┘

### 3.2 Cosa NON esce mai dal dispositivo

- Cronologia di ascolto completa
- Indirizzi IP (salvo toggle, e comunque mai inviati in rete)
- Dati di dispositivo e contesto
- Insights e inferenze psicologiche
- Playlist e libreria personale
- Ricerche effettuate

### 3.3 Cosa esce (solo con toggle esplicito)

| Dato | Destinazione | Trigger | Contenuto inviato |
|------|--------------|---------|-------------------|
| Nome brano + artista | MusicBrainz / iTunes Search API | `enrichMetadata` ON | Solo stringhe titolo/artista, nessun dato utente |
| Recording MBID | AcousticBrainz | `enrichMetadata` ON | Solo l'identificatore della registrazione (non un dato utente) |
| Anteprima audio 30 s | iTunes Search API | `enrichMetadata` ON | I **byte dell'audio** vengono scaricati e analizzati **in locale**: non escono e non vengono persistiti |
| Brano + timestamp ascolto | Last.fm / ListenBrainz | `scrobbleHubs` configurato (consenso **per-hub**) | **Payload di scrobbling chiuso per costruzione** (`05§4.2` V8): `idempotencyKey`, `startedAt`, `durationMs` (opzionale), `recordingMbid` (opzionale), `isrc` (opzionale), `artistName`, `trackName`, `albumName` (opzionale). **Nessun** campo per contesto, device, IP o insight: non è una policy, è il *tipo* |
| Ciphertext | Server sync (Fase 2) | `syncCloud` ON | Solo dati cifrati E2E |

## 4. Inventario dati personali trattati

| Dato | Categoria GDPR | Fonte | Persistito? | Base giuridica |
|------|----------------|-------|-------------|----------------|
| Cronologia ascolti (brano, artista, timestamp, durata) | Dati personali | Export utente | Sì (locale) | Consenso esplicito (art. 6.1.a) |
| Paese di connessione | Dati personali (derivato, non identificativo) | Derivato da IP | Sì (locale) | Necessario al servizio — consenso solo per `retainIp` |
| Indirizzo IP | Dati personali | Export piattaforma | Solo se `retainIp` | Consenso esplicito |
| Tipo dispositivo | Dati personali | Export piattaforma | Sì (locale), `car` solo se `carDetectionConsent` | Consenso esplicito |
| Inferenze mood/ere/eventi | Dati derivati (potenzialmente sensibili) | Calcolo locale | Sì (locale) | Consenso esplicito |
| **Audio features** (valence, energy, danceability, BPM, tonalità) | Dati derivati (potenzialmente sensibili) | Calcolo locale (Essentia.js) o dataset pubblico (AcousticBrainz) o stima euristica | Sì (locale, tabella `features`) | Consenso esplicito (toggle `enrichMetadata`) |
| **Query di ricerca per l'arricchimento** (nome brano + artista) | Dati personali | Ricerca su servizi pubblici | **No** — solo nel log di rete, senza PII | Consenso esplicito (toggle `enrichMetadata`) |
| Playlist e libreria | Dati personali | Export utente | Sì (locale) | Consenso esplicito |
| Ricerche effettuate | Dati personali | Export Spotify | Sì (locale, opzionale) | Consenso esplicito |
| Username ListenBrainz | Dati personali | Export ListenBrainz | **No** — letto da `user.json` e mai persistito | Consenso esplicito (art. 6.1.a) |
| User Token ListenBrainz | Segreto / credenziale | Account ListenBrainz | Sì (locale, Dexie), **mai** nei log, **mai** nelle fixture | Consenso esplicito (art. 6.1.a) |
| `inserted_at` (inserimento nel DB) | Dati personali | Export ListenBrainz | **No** — non è un tempo di ascolto | — |
| Username Last.fm | Dati personali | API Last.fm | Sì (locale, Dexie), **mai** nel bundle | Consenso esplicito (art. 6.1.a) |
| API key Last.fm | Segreto / credenziale | API Last.fm | Sì (locale, Dexie), **mai** nel bundle, **mai** nei log | Consenso esplicito (art. 6.1.a) |
| Shared secret Last.fm | Segreto / credenziale | API Last.fm (web auth) | Sì (locale, Dexie), **mai** nel bundle, **mai** nei log | Consenso esplicito (art. 6.1.a) |
| Session key Last.fm (`sk`) | Segreto / credenziale | API Last.fm (web auth) | Sì (locale, Dexie), **mai** nei log, **mai** nelle fixture | Consenso esplicito (art. 6.1.a) |
| URL del proxy Last.fm | Dati personali | API Last.fm (via proxy) | Sì (locale, Dexie), **mai** nel bundle | Consenso esplicito (art. 6.1.a) |
| **Payload di scrobbling** | Dati personali | Ascolti locali dell'utente | Sì (locale, `scrobbleOutbox`), inviato **solo** all'hub abilitato | Consenso esplicito per-hub (art. 6.1.a) |
| **Coda di invio** (`scrobbleOutbox`) | Dati personali (derivati dagli ascolti) | Enqueue locale | Sì (locale), **svuotata** quando l'hub viene revocato | Consenso esplicito per-hub (art. 6.1.a) |
| User Token ListenBrainz **in scrittura** | Segreto / credenziale | Account ListenBrainz | Sì (locale, Dexie), **mai** nei log, **mai** nelle fixture | Consenso esplicito (art. 6.1.a) |
| Session key Last.fm (`sk`) **in scrittura** | Segreto / credenziale | API Last.fm (web auth) | Sì (locale, Dexie), **mai** nei log, **mai** nelle fixture | Consenso esplicito (art. 6.1.a) |

**Il percorso di scrittura è chiuso per costruzione (Story 1.5, ratificata in
`20-SCROBBLING-HUB.md` v1.0 🟢 e `05§4.2` ADR-0011 🟢 v1.0).** Il tipo
`ScrobblePayload` **non ha** campi per contesto, device, IP o insight: non si
invia qualcosa che il tipo non contiene, e il `toggle retainIp` **non è
applicabile** al percorso di scrittura (l'IP non entra nel payload). I segreti
(`api_key`, shared secret, `sk`, User Token) restano nello `storage` locale
dell'utente e **non** vengono mai serializzati nel payload né nei log: la coda
`scrobbleOutbox` contiene il payload, non le credenziali.

**Nota (opzione A, issue #108)**: il `country` (paese di connessione) è un **dato derivato e non identificativo**: viene derivato dall'IP al parse e conservato indipendentemente dal toggle `retainIp`, come definito in `02-DATA-SCHEMA.md` §3.8 (🟢 APPROVED). Non richiede consenso esplicito: il consenso esplicito è richiesto solo per la ritenuta dell'indirizzo IP (`retainIp`) e per i trattamenti attivabili via toggle (`enrichMetadata`, `scrobbleHubs`, `syncCloud`, `carDetectionConsent`). Questo allinea `09` §4 a `02` §3.8 e scioglie la contraddizione segnalata in issue #108.

**Nota sui dati derivati**: le inferenze di mood e stati emotivi possono rivelare
caratteristiche personali profonde. Pur non essendo "categorie particolari" ex
art. 9 GDPR in senso stretto, sono trattate con la massima cautela: restano
locali, sono etichettate come ipotesi, e l'utente può cancellarle o correggerle.

## 5. Basi giuridiche GDPR

| Trattamento | Base giuridica | Note |
|-------------|----------------|------|
| Import e analisi locale | Art. 6.1.a — Consenso | L'utente importa volontariamente i propri dati |
| Arricchimento metadati | Art. 6.1.a — Consenso | Toggle esplicito, disattivabile |
| Scrobbling a hub terzi | Art. 6.1.a — Consenso | L'utente configura il servizio terzo |
| Sync cloud (Fase 2) | Art. 6.1.a — Consenso | E2E encrypted, opzionale |

**Nessun trattamento si basa su interesse legittimo**: tutto è consenso esplicito
e revocabile in qualsiasi momento (la revoca = cancellazione locale immediata).

## 6. Diritti dell'utente e implementazione tecnica

| Diritto GDPR | Implementazione in app |
|--------------|------------------------|
| **Accesso** (art. 15) | L'utente vede tutti i propri dati nell'app; export JSON completo |
| **Rettifica** (art. 16) | Correzione insight (`status: corrected`), override nomi brani |
| **Cancellazione** (art. 17) | "Cancella tutti i dati" con doppia conferma; `purgeIp()` selettivo |
| **Portabilità** (art. 20) | Export JSON strutturato di listens + insights |
| **Limitazione** (art. 18) | Toggle per disattivare singoli trattamenti (enrichment, scrobbling) |
| **Opposizione** (art. 21) | Revoca consenso = disattivazione trattamento |
| **Revoca consenso** (art. 7.3) | Ogni toggle revocabile; effetti immediati e locali |

### 6.1 Funzioni tecniche obbligatorie

- `exportAll(): Promise<Blob>` — JSON completo di tutti i dati locali
- `deleteAll(): Promise<void>` — wipe IndexedDB + localStorage
- `purgeIp(): Promise<void>` — azzera campo `ip` in tutti i listens
- `purgeInsights(): Promise<void>` — cancella solo le inferenze
- Ogni funzione è esposta in Settings → Dati

## 7. Privacy Policy (bozza pubblica)

> ⚠️ BOZZA — da revisionare con legale prima del lancio

### 7.1 Chi siamo

Life Soundtrack è un'applicazione web open source che trasforma i dati di
ascolto delle piattaforme di streaming in un diario musicale personale.
Non abbiamo server che raccolgono i tuoi dati: l'app funziona interamente
nel tuo browser.

### 7.2 Quali dati trattiamo

Trattiamo SOLO i dati che TU importi volontariamente dall'export della tua
piattaforma di streaming (Spotify, Apple Music, YouTube Music, ecc.):
cronologia ascolti, brani, artisti, timestamp, e — se lo attivi tu — indirizzi IP.

Tutti questi dati restano sul tuo dispositivo. Non li inviamo a nessun server.

**Credenziali di piattaforma**: quando colleghi un account esterno (per esempio
ListenBrainz, o Last.fm per il percorso API), la chiave di accesso che ci serve
resta **solo sul tuo dispositivo** (IndexedDB). Non la includiamo nei log, non la
pubblichiamo, non la condividiamo con terzi. Nella Story 1.3 il token ListenBrainz
è usato **solo in lettura** per le query incrementali: l'app non scrobba nulla per
conto tuo. Puoi revocarlo dalle impostazioni dell'account ListenBrainz in
qualsiasi momento, e l'app smette di usarlo al primo errore.

**Il proxy è tuo**: per usare l'API Last.fm dalla PWA serve un proxy, perché
l'API di Last.fm non invia le intestazioni CORS e il browser bloccherebbe la
richiesta. Il proxy lo configuri **tu** in Impostazioni; l'app non ne gestisce
nessuno e non ne controlla la logica. Il proxy vede le richieste che stai facendo
verso Last.fm, **compresa la tua chiave API**: è un servizio di cui ti fidi, come
un'estensione del browser o un client desktop. Puoi evitare del tutto questa
esposizione usando l'import da file, che non richiede proxy.

### 7.3 Come li usiamo

Li usiamo esclusivamente per mostrarti la tua timeline musicale, i tuoi
pattern di ascolto e i tuoi ricordi. Le analisi (mood, ere musicali, eventi)
sono calcolate localmente nel tuo browser e sono etichettate come ipotesi,
non come verità.

### 7.4 Condivisione con terze parti

Non condividiamo nulla con terze parti, tranne nei casi in cui sei TU ad
attivarlo esplicitamente:
- **Arricchimento metadati**: se attivi il toggle, inviamo il nome del brano
  a servizi pubblici (MusicBrainz, iTunes Search, AcousticBrainz) per recuperare
  caratteristiche musicali. L'anteprima audio di 30 secondi che scarichiamo
  viene analizzata **sul tuo dispositivo** e non viene conservata.
  Non inviamo nessun dato su di te.
- **Scrobbling**: se colleghi Last.fm o ListenBrainz, i tuoi ascolti vengono
  inviati a quei servizi secondo le loro privacy policy.
- **Sync cloud** (futuro): se lo attivi, i dati sono cifrati end-to-end e
  noi non possiamo leggerli.

### 7.5 I tuoi diritti

Puoi in qualsiasi momento: esportare tutti i tuoi dati, correggere le
inferenze, cancellare tutto, o revocare ogni consenso. Tutte queste operazioni
sono immediate e locali, nelle Impostazioni dell'app.

### 7.6 Conservazione

I dati restano sul tuo dispositivo finché non li cancelli. Non abbiamo copie
nei nostri server perché non abbiamo server che li raccolgono.

### 7.7 Contatti

[da compilare: email contatti + eventuale DPO]

## 8. Disclaimer inferenze psicologiche

Testo da mostrare nell'app (schermata Analisi e ogni InsightCard):

> **Le analisi emotive sono ipotesi, non diagnosi.**
> I mood, le "ere musicali" e gli "eventi" rilevati sono inferenze statistiche
> basate sulle caratteristiche musicali dei brani che ascolti. Non sono
> valutazioni psicologiche, mediche o cliniche. Possono essere imprecise.
> Sei tu a decidere se confermarle, correggerle o ignorarle.
> Se stai attraversando un momento difficile, parlane con una persona
> qualificata: questa app non è un sostituto del supporto professionale.

Implementazione:
- Testo completo in `08-COPY-I18N.md` chiave `insight.disclaimer`
- Versione corta (`insight.disclaimerShort`) come tooltip su ogni InsightCard
- Link "Come funzionano le analisi?" → pagina esplicativa

## 9. Note trademark e uso loghi

### 9.1 Principio

I nomi e i loghi di Spotify, Apple Music, YouTube Music, Deezer, Tidal,
SoundCloud, Last.fm, ListenBrainz sono marchi dei rispettivi proprietari.
Life Soundtrack NON è affiliata, sponsorizzata o approvata da essi.

### 9.2 Regole d'uso nell'app

| Elemento | Regola |
|----------|--------|
| **Nomi delle piattaforme** | Uso nominativo consentito ("Importa il tuo export Spotify") — necessario per descrivere la compatibilità |
| **Loghi ufficiali** | ❌ NON usare i loghi ufficiali senza licenza. Usare icone proprie stilizzate o testo |
| **Colori brand** | Evitare combinazioni che imitino l'identità visiva ufficiale |
| **Disclaimer** | Footer Settings: "I marchi citati appartengono ai rispettivi proprietari. Life Soundtrack non è affiliata a essi." |

### 9.3 Azioni richieste

- [ ] Sostituire i loghi ufficiali nei mockup con icone proprie (Sessione 7)
- [ ] Aggiungere disclaimer trademark in Settings e footer
- [ ] Verificare le brand guidelines di ogni piattaforma prima del lancio

## 10. Threat model

| # | Minaccia | Probabilità | Impatto | Mitigazione |
|---|----------|-------------|---------|-------------|
| T1 | Furto dispositivo con dati non cifrati | Media | Alto | Consigliare full-disk encryption OS; valutare cifratura IndexedDB (Fase 2) |
| T2 | XSS che legge IndexedDB | Bassa | Alto | CSP strict, nessun innerHTML con dati utente, sanitize input |
| T3 | Estensione browser malevola che legge IndexedDB | Media | Alto | Documentare il rischio; consigliare profile browser dedicato |
| T4 | Leak via chiamate enrichment | Bassa | Medio | Inviare solo titolo+artista; nessun dato utente; log pubblico delle chiamate |
| T5 | Repo pubblico espone dati reali | Bassa | Alto | Fixture SOLO sintetici; policy: mai commit di dati reali |
| T6 | Sync cloud compromesso (Fase 2) | Bassa | Alto | E2E encryption, chiavi solo sul dispositivo |
| T7 | Inferenze usate contro l'utente (es. assicurazioni) | Bassa | Alto | Dati mai inviati; disclaimer; export escluso insight su richiesta |

### 10.1 Regola d'oro per il repo

**Mai committare dati reali di ascolto nel repository.** I fixture in
`fixtures/` sono sintetici. Ogni PR che aggiunga dati reali va rifiutata.
Aggiungere check CI che scansioni i fixture per pattern sospetti (IP reali,
email).

## 11. Checklist compliance pre-lancio

- [ ] Privacy policy revisionata da legale qualificato
- [ ] Disclaimer inferenze presente in app (schermata Analisi + tooltip)
- [ ] Disclaimer trademark in Settings e footer
- [ ] Loghi ufficiali sostituiti con icone proprie
- [ ] Funzioni `exportAll`, `deleteAll`, `purgeIp`, `purgeInsights` testate
- [ ] Tutti i toggle privacy OFF di default verificato
- [ ] CSP strict configurata e testata
- [ ] Nessun dato reale nei fixture (check CI attivo)
- [ ] Cookie/banner non necessari (l'app non usa cookie di tracciamento)
- [ ] Registro dei trattamenti GDPR compilato (art. 30) — se applicabile
- [ ] Valutazione d'impatto (DPIA) considerata — probabilmente NON richiesta
      (nessun trattamento server-side, nessun dato sensibile ex art. 9 inviato)
- [ ] Email di contatto e responsabile dati pubblicata

## 12. Note finali

- L'architettura local-first riduce drasticamente gli obblighi GDPR: non
  essendoci trattamento server-side di PII, Life Soundtrack NON è "titolare
  del trattamento" per i dati che restano sul dispositivo dell'utente.
- Diventa titolare solo per: (a) dati inviati volontariamente a servizi terzi
  configurati dall'utente (ma lì il titolare è il servizio terzo), (b) eventuali
  statistiche anonime opt-in (Fase 2+), (c) sync cloud (Fase 2).
- Questo rende il progetto uno dei più privacy-compliant possibili per categoria.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 6 | Prima versione completa |
| 0.2 | 2026-10-21 (issue #109) | §4: la riga "Tipo dispositivo" dichiara che `car` viene persistito solo con `carDetectionConsent` attivo — il gate è applicato in scrittura dalla pipeline core (`applyCarConsent`), come già previsto da `02` §3.8 |
| 0.3 | 2026-10-26 (issue #145) | §4: tre righe nuove per ListenBrainz (username mai persistito, User Token locale e mai nei log, `inserted_at` mai persistito). §7: nota sulla destinazione del User Token (storage locale, uso **solo in lettura** nella 1.3) |
| 0.4 | 2026-10-26 (issue #144) | §4: cinque righe nuove per Last.fm (username, API key, shared secret, session key `sk`, URL del proxy) — tutte locali (Dexie), mai nel bundle, mai nei log. §7.2: nota sul **proxy** — è di fiducia dell'utente, vede la sua API key, e l'import da file ne evita l'esposizione |
| 0.5 | 2026-10-27 (issue #172) | **Story 1.5 — percorso di scrittura ratificato** (`20-SCROBBLING-HUB.md` v1.0 🟢 APPROVED, `05§4.2` ADR-0011 🟢 v1.0): §3.3 — la riga "Brano + timestamp ascolto" dichiara il **payload esatto** e il fatto che sia **chiuso per costruzione** (nessun campo per contesto, device, IP o insight: `retainIp` non è applicabile alla scrittura); §4 — tre righe nuove (payload di scrobbling, coda `scrobbleOutbox`, User Token e `sk` **in scrittura**) e una nota che chiarisce dove stanno i segreti (storage locale, mai nel payload né nei log) e cosa succede alla coda quando il consenso viene revocato. Header allineato (era fermo a v0.2 dal Sessione 6, mentre il changelog era già alla 0.4) |
| 0.6 | 2026-10-28 (issue #187) | Allineata alla spec `21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED): §3.1 il diagramma del flusso di rete non cita più **FreqBlog** (provider mai esistito, già rimosso da `02§3.4` e dalla CSP) ma i tre host reali (MusicBrainz, iTunes Search API, AcousticBrainz), e dichiara che l'anteprima audio di 30 s viene **analizzata in locale e non persiste**; §3.3 le tre righe di "cosa esce" (query per nome brano + artista, MBID, anteprima audio elaborata in locale); §4 le due righe mancanti dell'inventario (**audio features** e **query di ricerca** per l'arricchimento); §7.4 il testo pubblico della privacy policy aggiorna i servizi e dichiara il trattamento locale dell'anteprima. La riga **0.1** ("Prima versione completa") è stata riposizionata **in cima** alla tabella: era stata appesa fra la 0.4 e la 0.5 |