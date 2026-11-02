# 27 — Privacy, export e purge: la pagina dei dati e le impostazioni

> Status: 🟡 DRAFT (diventa **🟢 APPROVED v1.0** alla ratifica del project owner)
> Versione: 0.1
> Ultima modifica: Sessione 86 (2026-11-02)
> Responsabile: Boss
> Story: **5.1** (Privacy spec finale + pagina in-app) e **5.2** (Export e purge) — `docs/11-BACKLOG.md` · Area: `privacy`/`ui` · Size: M ciascuna
> Origine: `docs/22-COMPETITIVE-POSITIONING.md` §12, §13 · Specifiche tecniche: `docs/09-PRIVACY-SECURITY.md` (🟡 DRAFT v0.7) §6.1

---

## 🎯 Scopo

Il valore principale del progetto è la **privacy locale**: se la promessa non è **eseguibile** dall'utente, non è una promessa. Questa spec definisce:

1. **5.1** — la pagina in-app «**Come trattiamo i tuoi dati**» (il documento `09` tradotto in linguaggio utente) e il **montaggio** della schermata About (che oggi esiste ma **non è raggiungibile**);
2. **5.2** — **export completo** del diario (JSON + CSV), **purge selettivi** e **cancellazione totale** con doppia conferma, tutti esposti in **Impostazioni → Dati**.

> **Fuori perimetro (dichiarato)**: la ratifica di `docs/09-PRIVACY-SECURITY.md` a 🟢 APPROVED e il diagramma del data flow sono **atti del project owner** (AC della 5.1); questa spec copre la parte **implementabile** (UI + funzioni).

## 🔍 Stato reale (verificato in Sessione 86)

| Cosa dice la spec | Cosa c'è nel codice |
|-------------------|--------------------|
| `exportAll(): Promise<Blob>` (`09§6.1`) | ❌ **non esiste**: non c'è alcun dump del DB (15 tabelle) |
| `deleteAll(): Promise<void>` (`09§6.1`) | ❌ **non esiste**: `db.delete()` compare solo nei test |
| `purgeIp(): Promise<void>` | ✅ esiste | `packages/core/src/db/repositories.ts:78` |
| `purgeInsights(): Promise<void>` | ❌ non esiste (c'è `deleteInsightsById`) | `packages/core/src/db/insights.ts:58` |
| «Ogni funzione è esposta in **Settings → Dati**» | ❌ **la schermata Impostazioni (⑬) non esiste**: non c'è alcun `SettingsScreen` |
| `About` con l'offerta del sorgente (§13) | ⚠️ **dead code**: `apps/web/src/components/About.tsx` è importato **solo** dai test, non è montato da `App.tsx`/`AppShell.tsx` ⇒ **l'obbligo AGPL §13 non è soddisfatto nell'app reale** |
| `MaintenancePanel` | ⚠️ **dead code**: i pulsanti sono placeholder testuali (`rekey: eseguibile`), nessuna chiamata alle funzioni reali |
| Chiavi i18n `settings.data.export`, `settings.data.delete`, `settings.delete.confirm1/2`, `settings.delete.keyword` | ✅ esistono e **non sono usate** (`it.json:162–170`) |
| Chiavi `settings.privacy.retainCountry`, `.retainCountryDesc`, `.retainCity`, `.retainCityDesc`, `.retainDeviceType`, `.retainDeviceDetail`, `.deriveContext` | ⚠️ **documentate in `08-COPY-I18N.md` ma ASSENTI** da `it.json`/`en.json` |
| Comportamento dell'app dopo la cancellazione | `App.tsx` decide onboarding vs app **una volta** all'avvio (`countListens(db) > 0`): dopo `deleteAll()` serve un ritorno esplicito allo stato vuoto (⑭) |
| Drift rilevato | `apps/web/src/hooks/useDbHealth.ts:15` fissa `EXPECTED_SCHEMA_VERSION = 4`, mentre `db/health.ts:45` attende **6** |

## 🏗️ Cosa costruire

### A. Impostazioni (⑬) — la schermata che non esiste

`apps/web/src/screens/SettingsScreen.tsx` (nuova), con le **4 sezioni** di `06§2.13`:

| Sezione | Contenuto | Note |
|---------|-----------|------|
| **Piattaforme collegate** | stato delle 5 fonti importabili, reconnect/disconnect | la connessione Last.fm/ListenBrainz esiste già (`LastfmPanel`, `ScrobblePanel`) |
| **Privacy** | i toggle: `retainIp`, `retainCountry`, `retainCity`, `retainDeviceType`, `retainDeviceDetail`, `deriveContext`, `enrichMetadata`, `carDetectionConsent`, `syncCloud` | **7 chiavi i18n mancanti** da aggiungere in it/en (`08-COPY-I18N.md` le dichiara già) |
| **Dati** | «Esporta tutto (JSON)», «Esporta ascolti (CSV)», «Purga IP», «Purga insight», «Cancella tutti i dati» | pulsanti **prominenti**, non nascosti (`22` §12) |
| **Preferenze** | tema, lingua | il tema **non esiste** (`settings.prefs.theme.*` è copy morto): o si implementa o si dichiara fuori perimetro — D-27.4 |

> La sezione **Manutenzione** (`settings.maintenance.*`, 7 chiavi esistenti) va **collegata** alle funzioni reali: `rekey(db)`, `orphanCleanup(db)`, `recount(db)`, `fastCheck(db)`, `quotaCheck()` (`packages/core/src/db/`), sostituendo i placeholder di `MaintenancePanel.tsx`. È il lavoro che `docs/16-OPERATIONS.md` descrive e che nessuno può eseguire oggi.

### B. I dati — le quattro funzioni

```ts
// packages/core/src/db/dataExport.ts (nuovo)
export interface ExportManifest {
  readonly format: 'life-soundtrack-export';
  readonly version: 1;
  readonly exportedAt: number;
  readonly schemaVersion: number;
  readonly counts: Record<string, number>;
  readonly containsIp: boolean;      // true se qualche ascolto ha ancora l'IP
  readonly appVersion: string;
}

export async function exportAll(db: LifeSoundtrackDB): Promise<Blob>;
export async function exportListensCsv(db: LifeSoundtrackDB): Promise<Blob>;
export async function purgeIp(db: LifeSoundtrackDB): Promise<number>;         // numero righe modificate
export async function purgeInsights(db: LifeSoundtrackDB): Promise<number>;
export async function deleteAll(db: LifeSoundtrackDB): Promise<void>;
```

Requisiti:

1. **`exportAll`** → un **JSON** con il manifest + una sezione per tabella, tutte le 15 tabelle (`listens`, `tracks`, `artists`, `albums`, `features`, `sessions`, `insights`, `imports`, `library`, `playlists`, `playlistItems`, `searchQueries`, `settings`, `scrobbleOutbox`, `contexts`). La `Blob` è `application/json` con il nome `life-soundtrack-export-<data>.json`.
2. **Il manifest dichiara `containsIp`**: l'export è un file che esce dal dispositivo — se contiene IP o città, l'utente **deve saperlo** prima di condividerlo. È la versione operativa di «la privacy è una promessa che l'utente può eseguire».
3. **`exportListensCsv`** → CSV degli ascolti (portabilità GDPR, `09§6`): `eventKey, timestamp, startedAt, durationMs, trackName, artistName, albumName, platform, deviceType, city, country`, con quoting RFC 4180 e BOM UTF-8 (Excel).
4. **`purgeIp`** → riusa `purgeIp(db)` esistente (`db/repositories.ts:78`) ma **restituisce il numero** di righe toccate (la UI deve dire «N ascolti bonificati»).
5. **`purgeInsights`** → svuota la tabella `insights` (transazione).
6. **`deleteAll`** → **una sola transazione** che svuota tutte le 15 tabelle (non `db.delete()`: l'app deve restare viva e l'utente deve vedere lo stato vuoto, non un reload). Dopo `deleteAll` l'app **torna allo stato vuoto (⑭)**.

### C. La doppia conferma della cancellazione

Flusso (identico a `06§3.4`, con le chiavi già esistenti):

1. Click su «Cancella tutti i dati» → **modal 1**: `settings.delete.confirm1` («Sicuro?») + pulsante Continua;
2. → **modal 2**: `settings.delete.confirm2` + input che richiede la parola chiave `settings.delete.keyword` (**«ELIMINA»** in it, **«DELETE»** in en);
3. input corretto → `deleteAll(db)` → notifica → **ritorno allo stato vuoto (⑭)**.

> Il contratto del ritorno allo stato vuoto: `App.tsx` decide il modo all'avvio (`'checking' | 'onboarding' | 'app'` in base a `countListens(db) > 0`). Dopo la cancellazione, `SettingsScreen` deve **notificare** la shell (`onDataErased()`), che porta `App.tsx` a `'onboarding'` (o a uno stato vuoto dedicato). È un piccolo refactor di `App.tsx`/`AppShell.tsx`, da specificare.

### D. La pagina «Come trattiamo i tuoi dati» (5.1)

Una sezione (o una schermata) con **cinque blocchi**, il testo in chiaro:

1. **Cosa resta sul dispositivo**: tutto — ascolti, catalogo, feature acustiche, insight, contesto. Nessun backend, nessun account.
2. **L'unica uscita**: l'invio ai hub di scrobbling, **solo** se l'utente ha attivato quel hub (default: nessuno) e può disattivarlo da Impostazioni → Privacy; le credenziali restano locali.
3. **Cosa succede ai tuoi dati**: l'export li mette in un file che **esce** dal dispositivo (e contiene IP/città solo se hai lasciato quei toggle attivi); la cancellazione li elimina e l'app torna vuota.
4. **Il codice**: AGPL-3.0, sorgente pubblico, licenza, attribuzioni (la schermata About, che va **montata**).
5. **Cosa non facciamo**: niente telemetria, niente advertising, niente profilaggio — e la promessa è verificabile nel codice.

> **Requisito legale (AGPL §13)**: la schermata About esiste ma **non è montata**: l'obbligo di offerta del sorgente agli utenti che interagiscono via rete **non è oggi soddisfatto nell'app reale** (issue #202 lo considera fatto, ma il codice non lo rende raggiungibile). **Montare About è parte di questa story**, non un extra.

### E. Chiavi i18n mancanti (7)

Da `08-COPY-I18N.md` ma assenti dai locale:

`settings.privacy.retainCountry`, `settings.privacy.retainCountryDesc`, `settings.privacy.retainCity`, `settings.privacy.retainCityDesc`, `settings.privacy.retainDeviceType`, `settings.privacy.retainDeviceDetail`, `settings.privacy.deriveContext`

> Nota: il test `apps/web/src/__tests__/i18n.test.ts` verifica che **it** ed **en** abbiano lo stesso set di chiavi e che ogni chiaia appartenga a un namespace dichiarato: le 7 chiavi vanno aggiunte **in entrambi** i file, nello stesso ordine.

## 🔒 Privacy (questa è la story sulla privacy)

| Vincolo | Applicazione |
|---------|--------------|
| L'export è l'unico momento in cui i dati **escono** | il manifest dichiara `containsIp`; l'utente sceglie cosa salvare e dove |
| La cancellazione è completa | tutte le 15 tabelle, in una transazione; dopo, `countListens === 0` |
| La doppia conferma è reale | parola chiave, non un semplice sì |
| Le credenziali non lasciano il dispositivo | i token Last.fm/ListenBrainz restano nella tabella `settings` e **non** entrano nell'export (D-27.2) |
| L'app non raccoglie nulla | nessuna telemetria: il progetto non ne ha e la story non ne introduce |

## 🧪 Test

| Livello | File | Cosa copre |
|---------|------|-----------|
| unit (core) | `packages/core/src/db/__tests__/data-export.test.ts` | `exportAll` contiene **tutte** le tabelle e un manifest coerente (`counts` = righe reali, `containsIp` vero/false secondo i dati); il JSON è ri-parsabile |
| unit (core) | idem | `exportListensCsv`: intestazione, quoting, BOM, escaping di virgole e apici |
| unit (core) | `packages/core/src/db/__tests__/data-purge.test.ts` | `purgeIp` azzera tutti gli IP e restituisce il conteggio; `purgeInsights` svuota la tabella; `deleteAll` svuota **tutte** le 15 tabelle in una transazione (il test verifica che un errore a metà **non** lasci dati parziali) |
| integrazione (app) | `apps/web/src/screens/__tests__/settings-data.test.tsx` | pulsanti export/purge/delete presenti e **prominenti**; il download produce un file; dopo `deleteAll` l'app è nello stato vuoto |
| integrazione (app) | `apps/web/src/screens/__tests__/settings-delete-confirm.test.tsx` | la parola chiave sbagliata **non** cancella; quella giusta cancella |
| integrazione (app) | `apps/web/src/components/__tests__/about-mounted.test.tsx` | About è **raggiungibile** dalla navigazione (il test fallisce se resta dead code) |
| integrazione (app) | `apps/web/src/__tests__/i18n.test.ts` (esistente) | le 7 chiavi nuove sono in it **ed** en |

## ✅ Acceptance criteria

### Story 5.1
- [ ] Esiste la pagina in-app «Come trattiamo i tuoi dati» con i **cinque blocchi** della §D
- [ ] La schermata **About** è **montata e raggiungibile** dalla navigazione (l'obbligo AGPL §13 è soddisfatto nell'app reale)
- [ ] Le **7 chiavi i18n mancanti** sono presenti in it ed en
- [ ] I toggle di privacy esposti sono **tutti** quelli dello schema (`PrivacySettings`), con descrizioni
- [ ] Il drift `useDbHealth.EXPECTED_SCHEMA_VERSION = 4` vs `db/health.ts` (6) è **corretto**
- [ ] La sezione Manutenzione esegue le funzioni **reali** (`rekey`, `orphanCleanup`, `recount`, `fastCheck`, `quotaCheck`) e mostra il report

### Story 5.2
- [ ] «Esporta tutto (JSON)» produce un file con **tutte** le tabelle + manifest
- [ ] «Esporta ascolti (CSV)» produce un CSV valido (RFC 4180, BOM UTF-8)
- [ ] Il manifest dichiara `containsIp`: l'utente sa se il file contiene dati sensibili
- [ ] «Purga IP» e «Purga insight» sono eseguiti e **dicono** quante righe hanno toccato
- [ ] «Cancella tutti i dati» richiede **due conferme** (la seconda con la parola chiave) e svuota tutte le 15 tabelle
- [ ] Dopo la cancellazione l'app torna allo **stato vuoto**, senza reload e senza dati residui
- [ ] L'export **non include** le credenziali dei hub (D-27.2)

## 📋 Task

- T27.1 — Core: `packages/core/src/db/dataExport.ts` (`exportAll`, `exportListensCsv`) + test
- T27.2 — Core: `purgeIp` con conteggio, `purgeInsights`, `deleteAll` transazionale + test
- T27.3 — App: `SettingsScreen.tsx` con le 4 sezioni + navigazione (⑬) + `AppSection` estesa
- T27.4 — App: sezione Dati con export/purge/delete + doppia conferma + feedback (toast con il conteggio)
- T27.5 — App: ritorno allo stato vuoto dopo `deleteAll` (`App.tsx` / `AppShell.tsx`)
- T27.6 — App: montaggio di `About` + pagina «Come trattiamo i tuoi dati»
- T27.7 — App: sezione Manutenzione collegata alle funzioni reali (sostituire i placeholder)
- T27.8 — i18n: 7 chiavi mancanti + nuove chiavi della pagina privacy in it/en; allineamento di `docs/08-COPY-I18N.md`
- T27.9 — Correzione del drift `useDbHealth.EXPECTED_SCHEMA_VERSION`
- T27.10 — Allineamento documentale: `docs/09-PRIVACY-SECURITY.md` §6.1 (le funzioni ora esistono), `docs/16-OPERATIONS.md` (manutenzione), `docs/INDEX.md`, `docs/11-BACKLOG.md` (§5.1, §5.2), `docs/state/stories/5.1-*.md`, `docs/state/stories/5.2-*.md`

## 🧾 Decisioni proposte

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-27.1 | `deleteAll` **svuota le tabelle** in una transazione invece di `db.delete()` | L'app resta viva e l'utente vede lo stato vuoto (⑭); `db.delete()` lascerebbe l'app in uno stato incoerente |
| D-27.2 | L'export **non include** le credenziali dei hub (tabella `settings`: `lastfm.config`, `listenbrainz.config`) | Un file di export che contiene i token è un file che va perso con le chiavi; l'utente non li chiede e non li vuole in giro |
| D-27.3 | Il manifest dichiara `containsIp` (e in futuro `containsCity`) | L'export è l'unico momento in cui i dati escono: l'utente deve saperlo **prima** |
| D-27.4 | Il **tema** (chiaro/scuro) resta **fuori perimetro**: la sezione Preferenze mostra solo la lingua | `settings.prefs.theme.*` è copy morto e un tema è una story a sé (design system) |
| D-27.5 | La pagina privacy è una **sezione delle Impostazioni** (con link alla About), non una schermata a sé | Una schermata in più per cinque blocchi di testo è overhead; le Impostazioni sono già il luogo dove l'utente cerca «i miei dati» |
| D-27.6 | Il **punto di innesto** della Manutenzione è la sezione esistente `settings.maintenance.*` (7 chiavi già presenti) | Il copy c'è già: manca solo il wiring alle funzioni reali |

## 🚧 Cosa NON è in scope

- La **ratifica** di `docs/09-PRIVACY-SECURITY.md` e il diagramma del data flow (atti del project owner).
- Il **tema** chiaro/scuro (D-27.4).
- Il **sync cloud** (ADR-0005: self-hosted, Fase 2).
- La **cancellazione remota** di qualunque cosa: non esiste nessun server, quindi non c'è nulla da cancellare fuori dal dispositivo.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 86 (2026-11-02) | Prima stesura: stato reale (le 4 funzioni obbligatorie di `09§6.1`, 3 su 4 mancanti; Impostazioni e About dead code), contratti di export/purge/delete, doppia conferma, pagina privacy in 5 blocchi, 7 chiavi i18n mancanti, D-27.1…D-27.6 |

---

*Questo documento diventa vincolante (🟢 APPROVED v1.0) alla ratifica del project owner.*
