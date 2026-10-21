# ADR-0009 — Geolocalizzazione IP locale e derivazione in pipeline

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 40

## Contesto

`19-GEO-CONTEXT.md` §3 definisce tre livelli di contesto geografico. Il livello **L2 (città)** richiede di risolvere un indirizzo IP in una città, e si scontra con due constraint non negoziabili del progetto:

1. **Local-first** (`ADR-0002`): nessun server centrale, nessuna egress di dati dell'utente.
2. **Minimizzazione** (`09-PRIVACY-SECURITY.md` §3.2): "Dati di dispositivo e contesto" sono nell'elenco di ciò che **non esce mai dal dispositivo**.

Inoltre `02-DATA-SCHEMA.md` §3.8 azzera `ListenEvent.ip` al termine dell'import quando `retainIp` è `false` (default). Se la città venisse derivata dopo la persistenza, con il default dell'app **non sarebbe mai derivabile**. La derivazione deve quindi avvenire **dentro la pipeline, prima** dello scarto (`adapters/pipeline.ts:92`).

Resta la domanda: **dove vive il database IP→città, e chi lo interroga?**

## Decisione

**Geolocalizzazione IP interamente locale, con database MMDB embedded nell'applicazione, interrogato in-process durante l'import.**

- **Sorgente dati: DB-IP Lite City** (formato MaxMind `.mmdb`), licenza **CC BY 4.0**.
- **Nessuna egress**: nessuna richiesta di rete, nessuna chiave API, nessun account.
- **Nessuna persistenza dell'IP** derivata dal lookup: l'IP resta un input effimero; in DB finisce solo il campo derivato (`city`, `citySource`, `cityConfidence`), e l'IP solo se `retainIp` è attivo.
- **Il lookup è parte della normalizzazione** dell'adapter, non un arricchimento asincrono: `city` è disponibile nello stesso momento in cui l'evento viene scritto.
- **La città è sempre un dato stimato**: `cityConfidence` esplicito, soglia di scarto sotto 0.6, copy "circa X", correggibile dall'utente con `citySource = 'manual'`.

Il carico del DB sul bundle della PWA e la sua freschezza sono il principale costo di questa scelta e restano un **punto aperto** (§"Punti aperti").

## Motivazioni

- **Non c'è alternativa locale credibile.** `GeoLite2` di MaxMind è il free tier più diffuso, ma è la scelta sbagliata per un progetto open source: la GeoLite EULA vieta la ridistribuzione del database in un prodotto senza una **Commercial Redistribution License** a pagamento, e lega chi la riceve agli stessi vincoli — incompatibile con Apache-2.0.
- **DB-IP Lite è realmente ridistribuibile** (CC BY 4.0): l'unico onere è l'attribuzione, che è una riga in `⑭ Impostazioni` e nel footer di about. Nessun account, nessun `license key`, aggiornamento mensile.
- **Formato compatibile**: MMDB è lo standard di fatto e lo stesso reader funziona con GeoLite2 o IPinfo se l'utente vuole sostituirlo. Il codice di lookup non è legato al fornitore.
- **Nessun dato esce dal dispositivo**: la promessa di `09` §3.2 resta vera letteralmente, e il §7 della privacy policy non deve cambiare.
- **Costo di esercizio nullo**: nessuna chiave da ruotare, nessuna quota, nessun costo per utente — coerente con il business model open-source puro (D.10.x).
- **Coerenza con il principio "normalizza presto"** (`ADR-0003`): il dato viene derivato al parse, non in un secondo momento, quindi il `Listens` è completo e autosufficiente.

## Alternative considerate

| # | Alternativa | Esito | Motivo |
|---|---|---|---|
| **A1** | **API di geolocalizzazione remota** (ip-api.com, ipinfo, MaxMind GeoIP2 Web Service) | ❌ scartata | Invia l'IP dell'utente a un terzo: viola `09` §3.2 e `ADR-0002`, aggiunge un costo per utente e una dipendenza di disponibilità. Per un lookup offline e per 200k eventi anche le prestazioni sono insufficienti |
| **A2** | **MaxMind GeoLite2 embedded** | ❌ scartata | Licenza non consente la ridistribuzione in un prodotto Apache-2.0 senza licenza commerciale a pagamento che vincola downstream |
| **A3** | **MaxMind GeoLite2 scaricato al primo uso** (con account + license key) | ⚠️ **fallback** | Tecnicamente legittimo e più accurato, ma impone a ogni utente un account MaxMind prima di poter usare la funzione. Tenuto come via di fuga se la dimensione embedded (punto aperto 2) risultasse inaccettabile |
| **A4** | **Solo `country` (L0), nessuna città** | ❌ scartata | Scelta del Boss: il perimetro comprende L2. resta però il fallback operativo se L2 venisse abbandonato — in tal caso il progetto continua a funzionare con `country` + contesto dedotto |
| **A5** | **Derivazione lato server (batch)** | ❌ scartata | Contraria ad `ADR-0002`, e costerebbe il vantaggio privacy per cui L2 esiste |
| **A6** | **DB ospitato dall'utente (path custom)** | ⚠️ supportata | Prevista come opzione avanzata: l'utente può puntare a un proprio `.mmdb`. Copre l'utente enterprise/privacy che non vuole il DB embedded |

## Conseguenze

- **Positive**: nessuna egress, nessun costo, nessun account, funziona offline e in PWA, dato derivato e non identificativo, provider sostituibile (MMDB).
- **Negative**:
  - **Dimensione del bundle**: un DB City Lite è ordini di grandezza più grande di un Country Lite (pochi MB): va misurato in uno spike prima della ratifica.
  - **Freschezza mensile**: le allocazioni di blocchi IP cambiano; il DB invecchia tra una release e l'altra.Va esposto il *build date* del MMDB nella UI e la sua staleness è un fatto visibile, non un dettaglio nascosto.
  - **Accuratezza**: vedi `19-GEO-CONTEXT.md` §6.2 — `country` > 95%, `city` 70-78% e spesso errata su IP mobili (CGNAT e HQ operatore). L'ADR accetta questo limite **a condizione** che il dato resti dichiaratamente stimato.
  - **Attribuzione CC BY**: va esposta in `⑭ Impostazioni` e nel repository (NOTICE/LICENSE).
- **Mitigazioni**: `cityConfidence` + soglia 0.6 + copy "circa" + correzione manuale (`19` §6.3); `country` resta il dato su cui poggia il nastro (`19` §8.2).

## Punti aperti

1. **Embedded vs download-on-demand** — misurare la taglia reale del `.mmdb` City Lite e il suo impatto sul budget di bundle (Story 0.5 ha fissato un budget di 300 KB / 91 KB gzip: un DB di decine di MB lo sfonda necessariamente, e va deciso se entra nel bundle, in un asset scaricato a runtime, o in una build separata). **La misura manca**: la decisione va presa dopo uno spike, non prima.
2. **Soglia `cityConfidence`** — 0.6 è un valore ragionato, non misurato su dati reali.
3. **Aggiornamento del DB** — con A3/A6 l'utente può portare un DB più recente; va deciso se l'app offre un check di freschezza del build date e cosa dice quando il DB ha più di 60 giorni.

## Collegamenti

- `ADR-0002` local-first · `ADR-0003` normalizzazione early
- `19-GEO-CONTEXT.md` §6 (derivazione), §7 (toggle), §8 (UX)
- `02-DATA-SCHEMA.md` §3.8 (toggle), §8 (GPS mai raccolte)
- `09-PRIVACY-SECURITY.md` §3.2 (cosa non esce dal dispositivo)
- `01-PLATFORMS.md` §5 (E11, E12)

## Changelog

| Versione | Data | Modifiche |
|---|---|---|
| 0.1 | Sessione 40 | Prima stesura: DB-IP Lite embedded, derivazione in pipeline, alternative A1-A6, punti aperti su dimensione e freschezza |