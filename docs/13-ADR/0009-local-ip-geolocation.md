# ADR-0009 — Geolocalizzazione IP locale e derivazione in pipeline

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 67 (2026-10-30)
> Ratificato dal project owner il 2026-10-30 (issue #201). Vincolante per `19-GEO-CONTEXT.md` §6, `02-DATA-SCHEMA.md` §3.8, `09-PRIVACY-SECURITY.md` §3.2.

---

## Contesto

`19-GEO-CONTEXT.md` §3 definisce tre livelli di contesto geografico. Il livello **L2 (città)** richiede di risolvere un indirizzo IP in una città, e si scontra con due constraint non negoziabili del progetto:

1. **Local-first** (`ADR-0002`): nessun server centrale, nessuna egress di dati dell'utente.
2. **Minimizzazione** (`09-PRIVACY-SECURITY.md` §3.2): "Dati di dispositivo e contesto" sono nell'elenco di ciò che **non esce mai dal dispositivo**.

Inoltre `02-DATA-SCHEMA.md` §3.8 azzera `ListenEvent.ip` al termine dell'import quando `retainIp` è `false` (default). Se la città venisse derivata dopo la persistenza, con il default dell'app **non sarebbe mai derivabile**. La derivazione deve quindi avvenire **dentro la pipeline, prima** dello scarto (`adapters/pipeline.ts:92`).

Resta la domanda: **dove vive il database IP→città, e chi lo interroga?**

## Decisione

**Geolocalizzazione IP interamente locale, con database MMDB scaricato al primo uso e interrogato in-process durante l'import.**

- **Sorgente dati: DB-IP Lite City** (formato MaxMind `.mmdb`), licenza **CC BY 4.0**.
- **Il database NON è embedded nel bundle**: si scarica **on-demand al primo uso** (D-B.2, ratificata dal project owner il 2026-10-30, issue #201), si mette in **Cache Storage** e non entra nel precache del service worker (`12§2.1`). Il budget del bundle iniziale (`05§10`: 300 KB gzip) resta quindi **intatto**: è questa la ragione che scioglie il punto aperto della v0.1.
- **Nessuna egress dei dati dell'utente**: nessuna richiesta di rete che porti l'IP dell'utente a un terzo, nessuna chiave API, nessun account. L'unica rete ammessa è il download del **database** (un file pubblico, richiesto dall'utente, che non contiene dati dell'utente).
- **Nessuna persistenza dell'IP** derivata dal lookup: l'IP resta un input effimero; in DB finisce solo il campo derivato (`city`, `citySource`, `cityConfidence`), e l'IP solo se `retainIp` è attivo.
- **Il lookup è parte della normalizzazione** dell'adapter, non un arricchimento asincrono: `city` è disponibile nello stesso momento in cui l'evento viene scritto — *se* il database è presente.
- **La città è sempre un dato stimato**: `cityConfidence` esplicito, soglia di scarto sotto 0.6 (costante misurabile, D-B.3), copy "circa X", correggibile dall'utente con `citySource = 'manual'`.
- **Senza database non c'è città**: la derivazione è condizionata alla presenza del `.mmdb`; senza, `city = null`, `country` resta e l'utente vede l'avviso (edge case **E21**, `19§10`).

## Motivazioni

- **Non c'è alternativa locale credibile.** `GeoLite2` di MaxMind è il free tier più diffuso, ma è la scelta sbagliata per un progetto open source: la GeoLite EULA vieta la ridistribuzione del database in un prodotto senza una **Commercial Redistribution License** a pagamento, e lega chi la riceve agli stessi vincoli.
  > **Nota (Sessione 67, D-B.1)**: l'obiezione **non dipende dalla licenza dell'app**. Resta valida anche dopo il passaggio ad **AGPL-3.0**: il vincolo è della EULA di MaxMind, non della licenza del progetto. Nella v0.1 la motivazione era formulata come «incompatibile con Apache-2.0» — la ragione è cambiata, la conclusione no.
- **DB-IP Lite è realmente ridistribuibile** (CC BY 4.0): l'unico onere è l'attribuzione, che è una riga in `⑭ Impostazioni` e nel footer di about. Nessun account, nessun `license key`, aggiornamento mensile.
- **Formato compatibile**: MMDB è lo standard di fatto e lo stesso reader funziona con GeoLite2 o IPinfo se l'utente vuole sostituirlo. Il codice di lookup non è legato al fornitore.
- **Nessun dato esce dal dispositivo**: la promessa di `09` §3.2 resta vera letteralmente, e il §7 della privacy policy non deve cambiare.
- **Costo di esercizio nullo**: nessuna chiave da ruotare, nessuna quota, nessun costo per utente — coerente con il business model open-source puro (D.10.x).
- **Coerenza con il principio "normalizza presto"** (`ADR-0003`): il dato viene derivato al parse, non in un secondo momento, quindi il `Listens` è completo e autosufficiente.
- **Il download on-demand è lo stesso pattern già deciso per il WASM di Essentia** (`21§6.5`): fuori dal bundle iniziale, fuori dal precache, in Cache Storage con `CacheFirst`. Un solo modello mentale per due asset pesanti.

## Alternative considerate

| # | Alternativa | Esito | Motivo |
|---|---|---|---|
| **A1** | **API di geolocalizzazione remota** (ip-api.com, ipinfo, MaxMind GeoIP2 Web Service) | ❌ scartata | Invia l'IP dell'utente a un terzo: viola `09` §3.2 e `ADR-0002`, aggiunge un costo per utente e una dipendenza di disponibilità. Per un lookup offline e per 200k eventi anche le prestazioni sono insufficienti |
| **A2** | **MaxMind GeoLite2 embedded** | ❌ scartata | Licenza non consente la ridistribuzione in un prodotto senza licenza commerciale a pagamento che vincola downstream — indipendentemente dalla licenza dell'app (D-B.1) |
| **A3** | **MaxMind GeoLite2 scaricato al primo uso** (con account + license key) | ❌ scartata | Tecnicamente legittimo e più accurato, ma impone a ogni utente un account MaxMind prima di poter usare la funzione. Il **pattern** download-on-demand è stato però adottato (D-B.2), con DB-IP Lite che non chiede account |
| **A4** | **Solo `country` (L0), nessuna città** | ❌ scartata | Scelta del Boss: il perimetro comprende L2. resta però il fallback operativo se L2 venisse abbandonato — in tal caso il progetto continua a funzionare con `country` + contesto dedotto |
| **A5** | **Derivazione lato server (batch)** | ❌ scartata | Contraria ad `ADR-0002`, e costerebbe il vantaggio privacy per cui L2 esiste |
| **A6** | **DB ospitato dall'utente (path custom)** | ⚠️ supportata | Prevista come opzione avanzata: l'utente può puntare a un proprio `.mmdb`. Copre l'utente enterprise/privacy che non vuole il DB scaricato dall'app |
| **A7** | **DB-MMDB embedded nel bundle** | ❌ scartata | Era la decisione della v0.1: un `.mmdb` City Lite è di decine di MB e **sfonda necessariamente** il budget di 300 KB gzip (`05§10`). Il project owner ha ratificato il **download on-demand** (D-B.2) |

## Conseguenze

- **Positive**: nessuna egress dei dati dell'utente, nessun costo, nessun account, funziona offline dopo il primo download, dato derivato e non identificativo, provider sostituibile (MMDB), budget del bundle intatto.
- **Negative**:
  - **Il database è una dipendenza esterna all'utente**: senza rete (o senza aver scaricato il file) la città non c'è. Il paese — il dato su cui poggia il nastro (`19` §8.2) — non dipende dal database e resta sempre disponibile: **L0 regge da solo**, che è la ragione per cui `19` §3 dice «L0 e L1 sono il prodotto; L2 è il condimento».
  - **Freschezza mensile**: le allocazioni di blocchi IP cambiano; il DB invecchia tra una release e l'altra. Va esposto il *build date* del MMDB nella UI e la sua staleness è un fatto visibile, non un dettaglio nascosto.
  - **Accuratezza**: vedi `19-GEO-CONTEXT.md` §6.2 — `country` > 95%, `city` 70-78% e spesso errata su IP mobili (CGNAT e HQ operatore). L'ADR accetta questo limite **a condizione** che il dato resti dichiaratamente stimato.
  - **Un nuovo host di rete**: il download on-demand introduce un host che oggi **non è dichiarato** né nella CSP applicata (`apps/web/src/security/csp.ts`: `script-src 'self' 'wasm-unsafe-eval'`) né in `12§2.1`. L'host va dichiarato nella CSP applicata al bundle **nella story di implementazione** (Story 4.4), con la stessa disciplina con cui la D-AF.9 ha dovuto essere emendata (issue #196): la spec e la CSP applicata devono dire la stessa cosa.
  - **Attribuzione CC BY**: va esposta in `⑭ Impostazioni` e nel repository (NOTICE/LICENSE). È un deliverable della Story 4.4, che è la story che introduce il database nel prodotto.
- **Mitigazioni**: `cityConfidence` + soglia 0.6 + copy "circa" + correzione manuale (`19` §6.3); `country` resta il dato su cui poggia il nastro (`19` §8.2).

## Punti aperti — chiusi

1. **Embedded vs download-on-demand** → **chiuso**: **download on-demand** (D-B.2, ratificata dal project owner il 2026-10-30, issue #201). Il vincolo che rendeva necessaria la misura (il budget di 300 KB gzip) è esattamente ciò che la decisione elimina: il database non entra nel bundle. La **taglia reale** del `.mmdb` resta un dato da misurare per la UI (dimensione del download, come per il WASM di Essentia: `21§19` punto 2).
2. **Soglia `cityConfidence`** → **chiuso**: **0.6** è ratificata come **costante misurabile** (D-B.3): è il default vincolante, va esposta come parametro di config (e quindi entra nel `derivedVersion`), e va calibrata sul fixture realistico nella tranche di implementazione. Stesso trattamento per `confidence` 0.5 e `R6` 0.4 (`19` §5.2, §5.3).
3. **Aggiornamento del DB** → **chiuso**: l'app mostra il **build date** del `.mmdb` e lo segnala come **stale** oltre i 60 giorni (warning `cityDbStale`). Con il percorso on-demand l'utente può sempre sostituire il file con uno più recente (A6) o scaricarlo a mano.

## Collegamenti

- `ADR-0002` local-first · `ADR-0003` normalizzazione early
- `19-GEO-CONTEXT.md` §6 (derivazione), §7 (toggle), §8 (UX), §10 (E16..E21)
- `02-DATA-SCHEMA.md` §3.8 (toggle), §8 (GPS mai raccolte)
- `09-PRIVACY-SECURITY.md` §3.2 (cosa non esce dal dispositivo)
- `01-PLATFORMS.md` §5 (E16, E17)
- `21-AUDIO-FEATURES.md` §6.5 (il pattern download-on-demand del WASM)

## Changelog

| Versione | Data | Modifiche |
|---|---|---|
| 1.0 | 2026-10-30 (issue #201) | **Ratificata**: da 🟡 DRAFT v0.1 a 🟢 APPROVED v1.0. Il project owner ha ratificato tre decisioni: **(D-B.1)** l'app passa ad **AGPL-3.0** (`LICENSE`, D-AF.2 di `21§3`); **(D-B.2)** il database MMDB è **scaricato on-demand al primo uso**, non embedded nel bundle (il budget di 300 KB gzip, `05§10`, resta intatto); **(D-B.3)** le soglie dell'algoritmo (`confidence` 0.5, `R6` 0.4, `cityConfidence` 0.6) sono **costanti misurabili**: default vincolanti, da calibrare sul fixture realistico nella tranche di implementazione. Modifiche alla v0.1: la decisione passa da «embedded» a «download on-demand»; la motivazione su MaxMind GeoLite2 è riscritta (l'obiezione non dipende dalla licenza dell'app: è la EULA di MaxMind — la conclusione non cambia, la ragione sì); l'alternativa «embedded» è esplicitata come **A7** con il perché (il budget); l'obbligo di attribuzione CC BY e il nuovo host di rete sono dichiarati come deliverable della Story 4.4; i tre punti aperti sono chiusi con le rispettive decisioni. |
| 0.1 | Sessione 41 | Prima stesura: DB-IP Lite embedded, derivazione in pipeline, alternative A1-A6, punti aperti su dimensione e freschezza |
