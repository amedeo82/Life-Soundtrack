# 19 — Geo & Contesto di ascolto

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 40 (2026-10-21)
> Da ratificare in: `02-DATA-SCHEMA.md` v1.3 (🟢 APPROVED), `09-PRIVACY-SECURITY.md`, `04-ANALYSIS-ALGORITHMS.md`
> Decisione architetturale collegata: [`13-ADR/0009-local-ip-geolocation.md`](13-ADR/0009-local-ip-geolocation.md)

---

## 1. Il problema

La domanda "cosa stavo ascoltando, **dove** e **su che dispositivo**?" è già mezzo risolta nel database e completamente inutilizzata.

`ListenEvent` ha tre campi di contesto (`02-DATA-SCHEMA.md` §3.2), l'adapter Spotify li popola (`spotify/mapEvent.ts:167-170`), la pipeline li scrive (`adapters/pipeline.ts:90-93`) — e **nessun altro li legge**: non la UI, non le analisi, nessun insight. Sono dati già raccolti, già conservati localmente, già conformi alla privacy-by-design, che non producono nulla.

Questo documento definisce come trasformarli in un "diario di ascolto" leggibile, e dove il perimetro va tracciato.

## 2. Cosa c'è nelle fonti (vincolo hard)

| Piattaforma | Paese | IP | Dispositivo | Note |
|---|:---:|:---:|:---:|---|
| **Spotify** | ✅ `conn_country` | ✅ `ip_addr` | ✅ `platform` | unica fonte di contesto |
| **YouTube Music** | ⚠️ `locationInfos` | ❌ | ❌ | scartato al parse da `youtube-music.md` §7 (D.39.8) |
| **Apple Music** | ❌ | ❌ | ❌ | edge case **E9**: nessun campo contestuale |
| **Deezer / Tidal / SoundCloud** | ❌ | ❌ | ❌ | nessun contesto |
| **Last.fm / ListenBrainz** | ❌ | ❌ | ❌ | nessun contesto |
| **Plex / Navidrome** | ❌ | ❌ | ❌ | nessun contesto |

Tre conseguenze che la spec deve dichiarare apertamente, perché determinano le aspettative di prodotto:

1. **Il diario sarà asimmetrico.** Per un utente Spotify è ricco; per un utente Apple/Last.fm sarà quasi vuoto ("ascoltavo musica, non so dove"). Nessuna quantità di algoritmi può colmare un campo che il provider non esporta.
2. **Il livello di dettaglio massimo è il paese.** Non esistono città né coordinate nelle fonti. La città (L2) può solo essere *stimata* dall'IP, con l'accuratezza e i limiti descritti in §8 e in ADR-0009.
3. **Nessun dato di posizione GPS.** `02-DATA-SCHEMA.md` §8 ("Coordinate GPS: mai raccolte") resta vincolante e non viene toccato: qui non si raccoglie nulla dal dispositivo, si *deduce* da dati che il provider ha già esportato.

## 3. Architettura a tre livelli

| Livello | Cosa | Origine del dato | Costo | Rischio |
|---|---|---|:---:|:---:|
| **L0** | Paese di connessione | `conn_country` (direttamente dall'export) | ~0 | basso (>95% accurate) |
| **L1** | Contesto dedotto (casa / lavoro / in auto / viaggio) | pattern su paese + ora locale + dispositivo + ricorrenza | ~0 (CPU locale) | medio (è un'inferenza) |
| **L2** | Città stimata | geolocalizzazione locale dell'IP | medio (DB ~decine di MB, lookup per evento) | alto (accuratezza scarsa su IP mobili) |

**L0 e L1 sono il prodotto; L2 è il condimento.** Il diario deve reggere anche se l'utente tiene L2 disattivato — ed è il default.

## 4. Modello dati proposto (delta su `02-DATA-SCHEMA.md` v1.3)

### 4.1 Campi aggiunti a `ListenEvent`

Solo campi **non derivabili**. Tutto ciò che è ricostruibile dagli eventi non si mette nella tabella calda (200k+ righe): va in una tabella derivata (§4.3), come da MIG-2.

| Campo | Tipo | Origine | Note |
|---|---|---|---|
| `city` | `string \| null` | L2, derivata a import dal campo `ip` | mai mostrata come fatto |
| `citySource` | `'dbip-lite' \| 'manual' \| null` | provenance | `"circa Parigi"` se non-manual, `"Parigi"` se corretta a mano |
| `cityConfidence` | `number \| null` | 0..1 | sotto soglia → `city = null` (vedi §8) |

`country`, `deviceType`, `deviceDetail` **esistono già** e non vengono rinominati: cambiano solo le regole di retention (§6).

### 4.2 `city` non è un campo GPS

Non è una coordinata, non è un punto sulla mappa, non permette di localizzare un singolo ascolto con precisione superiore alla scala città (e su IP mobili spesso nemmeno quella). È una **derivazione granulare di un campo già presente nell'export GDPR** dell'utente. La riga "Coordinate GPS: mai raccolte" di `02` §8 resta vera e va mantenuta.

### 4.3 Entità derivata: `ContextPeriod`

Il contesto non sta sull'evento (si ripeterebbe identico su migliaia di righe): sta su un **periodo**, ricostruibile con `recompute()`.

```ts
export const CONTEXT_KINDS = [
  'home',        // cluster ricorrente, sera/notte/mattino presto
  'work',        // cluster ricorrente, orario lavorativo, device desktop/web
  'commute',     // sessioni brevi fuori dal cluster dominante
  'car',         // deviceType='car' o pattern di ascolto in viaggio (richiede consenso)
  'travel',      // paese diverso dal paese di riferimento
  'away',        // periodo senza dati di paese (es. solo ascolti YouTube/Apple)
  'unknown',     // segnali insufficienti: NON si indovina
] as const;

export interface ContextPeriod {
  id: string;
  startTime: number;          // unix ms UTC
  endTime: number;            // unix ms UTC
  kind: ContextKind;
  country: string | null;
  city: string | null;
  eventCount: number;
  deviceTypes: DeviceType[];
  /** 0..1 — sotto 0.5 il periodo resta `unknown` e non viene aggregato */
  confidence: number;
  /** hash dei parametri dell'algoritmo (MIG-3) */
  derivedVersion: string;
  /** verdetto utente: stesso modello di `Insight.status` */
  status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
  userLabel: string | null;   // "Casa di mia madre", "Parigi, aprile"
  createdAt: number;
}
```

`userLabel` è il punto in cui il diario diventa personale: l'algoritmo propone, l'utente batte le spalle.

## 5. L1 — Classificatore di contesto

Algoritmo **deterministico e versionato**, non ML: same reasoni di `04-ANALYSIS-ALGORITHMS.md` (ricalcolabile, ispezionabile, testabile con fixture).

### 5.1 Segnali

| Segnale | Sorgente | Peso |
|---|---|---|
| `country` | `ListenEvent.country` | alto (viaggio) |
| ora locale | `startedAt` in `userTimezone` (IANA) | medio-alto |
| `deviceType` | `ListenEvent.deviceType` | medio |
| durata sessione | derivata (MIG-2) | medio |
| ricorrenza settimanale | conteggio eventi per (ora, device, paese) | alto per home/work |

### 5.2 Regole (ordine di valutazione, prima che vince)

| # | Condizione | `kind` | Confidenza base |
|---|---|---|:---:|
| R1 | nessun `country` e nessun `deviceType` utile | `unknown` | — |
| R2 | `deviceType = 'car'` (da `CarPlay`/`Android Auto`) | `car` | 0.9 |
| R3 | paese ≠ paese di riferimento (moda su 90gg) per ≥ 3 giorni | `travel` | 0.9 |
| R4 | paese = riferimento, stessa fascia oraria (banda 2h) + stesso `deviceType`, ≥ 60% delle settimane | `home` | 0.7 |
| R5 | paese = riferimento, ore 09-18 feriali + `deviceType ∈ {desktop, web}` + ricorrenza ≥ 50% | `work` | 0.6 |
| R6 | `deviceType = mobile` + durata < 25min + fuori dai cluster R4/R5 | `commute` | 0.4 ⚠️ |
| R7 | nessuna delle precedenti | `unknown` | — |

**R6 è deliberatamente sotto la soglia**: "ascoltavo qualcosa mentre andavo a lavoro" non è deducibile da 4 segnali deboli. Sta a 0.4, quindi non viene aggregato come periodo e non compare nel nastro. Se l'utente lo conferma manualmente, il `status` passa a `confirmed` e il periodo viene mantenuto con la label data.

### 5.3 Soglie e fallback

- `confidence < 0.5` → il periodo **non viene aggregato** (E14).
- Il paese di riferimento = moda dei `country` degli ultimi 90 giorni con almeno 30 eventi; altrimenti il paese più frequente dell'intero storico.
- `userTimezone` deve essere persistito a livello app: oggi esiste solo dentro `PatternPayload.userTimezone` (`02` §4), che è un campo derivato — serve una sua copia nelle impostazioni per non dipendere dal ricalcolo.
- `car` **inferito** (non da `deviceType='car'`) richiede `PrivacySettings.carDetectionConsent` (`02` §3.8). `car` **mappato** dalla stringa `platform` è dato grezzo e non richiede consenso.

### 5.4 Cosa NON facciamo

- **Nessun `outdoors`**: non è distinguibile da `home` con questi dati. Inventare l'etichetta produrrebbe storie false.
- **Nessun clustering non supervisionato**: i cluster variano tra esecuzioni e rendono `derivedVersion` non-deterministico.
- **Nessuna inferenza di device oltre `deviceType`**: la stringa grezza resta un dato, non un contesto.

## 6. L2 — Città stimata

### 6.1 Dove avviene la derivazione

**Dentro la pipeline di import, prima che l'IP venga azzerato** (`adapters/pipeline.ts:92`):

```
record.ip_addr ──► deriveCity(ip) ──► city / citySource / cityConfidence
                        │
                        └──► ListenEvent.ip ──► null (salvo retainIp)
```

Il campo derivato entra nel DB; l'IP no. È la stessa logica di minimizzazione che già vale per `country` (derivato, conservato, IP scartato), estesa a un livello più fine. Il risultato è che l'opzione "città" **non costa nulla in termini di esposizione dell'IP**.

### 6.2 Perché la città non può essere trattata come il paese

Dati pubblici sui free tier di geolocalizzazione IP:

| Campo | Accuratezza free tier |
|---|---|
| `country` | **> 95%** ovunque |
| `city` | ~70-78% in Nord America ed Europa occidentale, peggio altrove |

E soprattutto: **gli IP mobili risolvono spesso all'HQ dell'operatore**, non alla posizione reale dell'utente. Per un'app musicale il caso dominante è proprio l'ascolto da smartphone via rete mobile. Su quel traffico la città è spesso semplicemente sbagliata.

Conseguenze di progetto, non rimandabili:

1. `city` **non è mai presentata come fatto**: la UI mostra sempre `citySource !== 'manual'` → "circa *X*" e il valore è confidenza-esplicita.
2. `cityConfidence < 0.6` → `city = null`, con warning `cityLowConfidence` (E11).
3. Il nastro contesto mostra **il paese**; la città è un dettaglio del dettaglio.
4. Il `ContextPeriod` resta valido anche senza `city`: `travel` si basa sul paese, che è affidabile.

### 6.3 Provenance e correzione

`citySource = 'manual'` + `userLabel` implementano la correzione: se l'utente scrive "Parigi, aprile 2019", il valore non viene più sovrascritto dai ricalcoli e la UI smette di dire "circa".

## 7. Toggle e override per import

### 7.1 Toggle globali (`PrivacySettings`, `02` §3.8 — proposta v1.3)

| Toggle | Default | Governa | Motivazione del default |
|---|:---:|---|---|
| `retainIp` | `false` | persistenza dell'IP | invariato (`02` §3.8) |
| `retainCountry` | **`true`** | persistenza di `country` | è il cuore del prodotto ed è già conservato oggi: metterlo a `false` sarebbe una regressione di feature, non un rafforzamento della privacy |
| `retainCity` | `false` | derivazione + persistenza di `city` | dato stimato, accuratezza scarsa, più sensibile del paese → **opt-in** |
| `retainDeviceType` | `true` | persistenza di `deviceType` | 8 valori granulari, nessun identificativo |
| `retainDeviceDetail` | `false` | persistenza di `deviceDetail` | è la **stringa grezza** del provider (`"iPhone di Mario"`): dato identificante, opt-in |
| `deriveContext` | `true` | classificazione L1 | non raccoglie nulla di nuovo: opera su dati già conservati |
| `carDetectionConsent` | `false` | inferenza `car` | invariato (`02` §3.8) |

⚠️ **Il default di `retainCountry` è la decisione più sensibile di questo documento** e va confermata dal Boss: `09-PRIVACY-SECURITY.md` §4 classifica oggi "Paese di connessione" come dato personale con base di liceità **consenso esplicito**, mentre `02` §3.8 lo conserva comunque. Il proposta risolve la contraddizione in favore di `02` (che è APPROVED) e allinea `09`; l'alternativa è invertire la scelta e metterlo a `false`. Finché non è deciso, la riga resta **bloccata** in `02` v1.3.

### 7.2 Override per singolo import

Il pannello di scelta durante l'import non modifica le impostazioni globali: produce un override valido **per quella sessione di import**, perché l'utente potrebbe voler conservare il paese oggi e l'IP domani.

```ts
export interface ImportFieldSelection {
  country: boolean;
  city: boolean;
  deviceType: boolean;
  deviceDetail: boolean;
  ip: boolean;
  deriveContext: boolean;
  ytLocationInfos: boolean;   // default scartato, vedi §9
}
```

**Valore effettivo** per un campo = `override[campo] ?? PrivacySettings[campoMappato]`. L'override ha la precedenza ed è mostrato attivamente nella UI (chip "solo per questo import") per non lasciare il dubbio su quale legge sia in vigore.

Il pannello mostra l'anteprima del fallout: *"disattivando Paese, ~12.400 eventi su 45.000 perderanno il paese"*. Un toggle che cambia retroattivamente dati già importati va detto, non applicato in silenzio.

## 8. UX

### 8.1 Pannello "Cosa importare" (schermata ③)

1. **Livello globale**, aperto dal bottone "Cosa importare" prima di "Importa tutto": una riga per campo, con default, conteggio eventi coinvolti e spiegazione in una riga.
2. **Override per card**: icona ingranaggio sulla `PlatformCard` per un sotto-pannello limitato a quella piattaforma (es. "usa `locationInfos` di YouTube solo per questo file").
3. Lo stato selezionato è serializzato nell'`ImportRecord`, così l'utente può ricostruire a posteriori cosa ha scelto.

### 8.2 Nastro contesto (schermata ⑦, Timeline)

Una striscia orizzontale sotto le `EraBand`, sincronizzata con lo zoom:

- un segmento per `ContextPeriod`, **colore per `kind`**, etichetta paese (+ "circa città" solo se `citySource = 'dbip-lite'`);
- sotto il segmento: pips dei `deviceType` presenti;
- click → schermata ⑧ con dettaglio del periodo, elenco eventi, e azioni utente (`confirmed` / etichetta / `dismissed`);
- filtro per `kind`, paese, dispositivo;
- **nessuna mappa**: nessuna dipendenza MapLibre/Leaflet, nessun tile online, nessun placeholder cartografico — la scala disponibile (paese, talvolta città) non giustifica una mappa e un tile implicherebbe uscita di rete.

### 8.3 Copy

`08-COPY-I18N.md` riceverà chiavi con la forma `settings.privacy.*` (già esistenti per `retainIp`) e `timeline.context.*`. Regola di linguaggio vincolante: **la città è sempre introdotta da un indicatore di incertezza** ("circa", "~"), il paese mai.

## 9. YouTube `locationInfos` — revoca di D.39.8

La Sessione 39 (issue #96, PR #97) ha deciso lo scarto incondizionato di `locationInfos`. Questa sessione **revoca** quella decisione: il campo viene letto solo se `ytLocationInfos` è attivo (default `false`), e in quel caso concorre con `conn_country`/`ip` per la derivazione L0/L2 secondo la stessa catena degli altri campi.

La motivazione originale (D.39.8: "nessun toggle dedicato nello schema → scarto incondizionato") cessa di valere: il toggle dedicato è esattamente ciò che `19-GEO-CONTEXT.md` §7.1 introduce. La revoca è formalizzata come **D.40.x** e comporta la modifica di `03-ADAPTERS/youtube-music.md` §7 in una sessione successiva.

## 10. Edge case nuovi

| # | Caso | Comportamento | Warning |
|---|---|---|:---:|
| **E11** | IP non risolvibile nel DB locale | `city = null`, `country` resta | `cityUnresolved` |
| **E12** | IP riservato o CGNAT (RFC1918, 100.64/10, link-local) | **nessuna** geolocalizzazione possibile | `citySkipped` |
| **E13** | Cambio paese improvviso | `travel`, non errore | `countryShift` |
| **E14** | Nessun cluster dominante | `unknown`, `confidence` bassa, non aggregato | `contextAmbiguous` |
| **E15** | Re-import con toggle diversi | I campi già persistiti **non** vengono azzerati; il contesto si ricalcola solo con `recompute()` esplicito | `contextStale` |

**E12 è il caso più frequente del progetto**: le reti mobili usano CGNAT per decine di milioni di indirizzi, e quegli IP non sono geolocalizzabili per definizione. Va detto all'utente nella schermata di import, non scoperto dopo.

E1..E10 restano invariati (§5 `01-PLATFORMS.md`); E11..E15 si aggiungono a catalogo in `01-PLATFORMS.md` §5.

## 11. Impatto sui documenti

| Documento | Modifica | Sessione |
|---|---|:--:|
| `13-ADR/0009-local-ip-geolocation.md` | **nuovo** — scelta del DB e del modello di derivazione | 40 |
| `02-DATA-SCHEMA.md` | v1.3: `city`/`citySource`/`cityConfidence`, `ContextPeriod`, tabella `contexts`, toggle, migrazione Dexie v2→v3 | 41 |
| `03-ADAPTERS/youtube-music.md` | v2: revoca D.39.8, `locationInfos` dietro toggle | 41 |
| `09-PRIVACY-SECURITY.md` | risolvere la contraddizione su `country`; inventariare `city` e `ContextPeriod`; §3.1 data flow con la derivazione | 41 |
| `01-PLATFORMS.md` | E11..E15 + matrice disponibilità geo | 41 |
| `04-ANALYSIS-ALGORITHMS.md` | Context Classifier (§5) come algoritmo di Fase 2 | 42 |
| `06-UX-FLOWS-STATES.md` / `07-UI-SPEC.md` | pannello ③ e nastro ⑦ | 42 |
| `08-COPY-I18N.md` | chiavi `timeline.context.*` | 42 |
| `11-BACKLOG.md` | Story 1.6 (fondazione geo), 4.4 (DB IP→città), 3.4 (nastro contesto) | 42 |

## 12. Punti aperti (bloccano la ratifica)

1. **Default di `retainCountry`** — `true` (§7.1) o `false`? La proposta è `true`; la decisione scioglie la contraddizione `02` §3.8 ↔ `09` §4.
2. **DB geo embedded o scaricato al primo uso?** — ADR-0009 §"Punti aperti". Un DB City Lite è ordini di grandezza più grosso di un Country Lite (pochi MB): va misurato prima di scegliere, per non inflazionare il bundle della PWA.
3. **Soglia di aggregazione 0.5 e regola R6 a 0.4** — sono numeri ragionati, non misurati. Lo spike li calibra su un fixture realistico.

## 13. Changelog

| Versione | Data | Modifiche |
|---|---|---|
| 0.1 | Sessione 40 (2026-10-21) | Prima stesura: L0/L1/L2, tassonomia `ContextKind`, classificatore deterministico, modello dei toggle + override per import, nastro contesto, revoca di D.39.8, edge case E11..E15 |