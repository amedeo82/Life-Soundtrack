# ADR-0005 — Sincronizzazione cloud self-hosted (placeholder, Fase 2)

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 9 (audit 2026-10-15)
> **NON implementato nel MVP.** Da rivedere e portare a 🟢 APPROVED prima dell'implementazione.

## Contesto

`05-ARCHITECTURE.md §8` e D.A.7 prevedono che la sincronizzazione cloud tra dispositivi **non sia presente nel MVP** ma venga affrontata in Fase 2 come servizio **self-hosted opzionale** (mai SaaS gestito da noi, in coerenza con D.A.9-D.A.11). `00-VISION.md` (D.A.12) ha fissato i requisiti di alto livello:

- Crittografia end-to-end (XChaCha20 o AES-256)
- Consenso granulare per categoria (track, era, insight)
- Zero telemetria di sync

Questo ADR è un **placeholder** che fissa i vincoli non negoziabili e identifica le decisioni aperte da risolvere prima dell'implementazione.

## Decisione (provvisoria)

Quando implementato (Fase 2):

1. **Architettura**: server di sync self-hosted, opzionale. L'utente può ospitarlo su NAS, Raspberry Pi, VPS personale, Functory, ecc. Il progetto **non fornisce** un'istanza SaaS.
2. **Crittografia**: end-to-end. Il server riceve solo blob cifrati autenticati (AEAD). Il client detiene la chiave di derivazione (Argon2id da passphrase utente + salt per-device).
3. **Consenso granulare**: l'utente sceglie **per ogni categoria** (`listens`, `tracks`, `artists`, `insights`, `eras`, `searchQueries`) se sincronizzarla. Default: spento.
4. **Zero telemetria di sync**: il server non vede mai `deviceId`, IP del client (a meno di reverse-proxy gestito dall'utente), né metadati di utilizzo del sync.
5. **Conflitti**: CRDT o last-writer-wins per record con `updatedAt`. La scelta concreta dell'algoritmo è una decisione aperta (vedi sotto).
6. **Trasporto**: HTTPS obbligatorio. WebSocket o HTTP/2 long-poll per push.
7. **Autenticazione**: token locale per-device, generato al pairing, revocabile dall'utente in qualsiasi momento.

## Alternative considerate

- **SaaS gestito da noi**: scartata (D.A.9 no monetizzazione + D.A.11 self-hosting).
- **Sync solo Bluetooth/LAN tra device dell'utente**: interessante ma non esclude la necessità di un ADR per il caso multi-device remoto; complementare, non sostitutivo.
- **Nessun sync per sempre**: possibile ma spegne una promessa di prodotto (multi-device).

## Conseguenze attese

- Positive: multi-device per self-hoster; zero lock-in; compatibile con privacy-by-default.
- Negative: complessità implementativa significativa (CRDT, key management, pairing UX); richiede documentazione di self-hosting più ricca.
- Mitigazioni: build progressiva; MVP single-device resta la baseline.

## Decisioni aperte (da chiudere PRIMA dell'implementazione)

| # | Decisione | Note |
|---|-----------|------|
| 1 | Algoritmo di conflict resolution (CRDT vs LWW vs operational transform) | Influenza struttura record e UX |
| 2 | Key management: passphrase-only vs recovery key vs entrambi | Trade-off sicurezza/UX |
| 3 | Pairing flow: QR code locale, Magic Link via mail,OPAQUE | Vincolato a `06-UX-FLOWS` |
| 4 | Server reference implementation: Node+Fastify+SQLite vs PocketBase vs custom | Influenza `12-DEVOPS` |
| 5 | Retention: conservazione sul server di record cancellati lato client (tombstone) | Per quanto? |
| 6 | Cadenza di push: real-time WebSocket vs poll periodico | Trade-off banda/latency |
| 7 | Cifratura del database server-side a riposo (defense in depth) | AES-256 con KEK del server |
| 8 | Audit log locale delle operazioni di sync (no PII) | Per trasparenza utente |

## Vincoli non negoziabili (carry-over da D.A.7/D.A.12)

- Niente telemetria
- Niente PII senza consenso esplicito
- Server **mai** requisito per il funzionamento della app
- E2EE: il server **non può** leggere il contenuto

## Implementazione nel MVP (Fase 0/1)

Nessuna. Questo ADR è **segnaposto**. Il codice di sync non deve essere importato; le dipendenze (libraries CRDT, auth OPAQUE) non devono essere aggiunte.

## Riferimenti

- `00-VISION.md` §Decisioni Strategiche (D.A.12)
- `02-DATA-SCHEMA.md §3.7 PrivacySettings.syncCloud` (v1.1)
- `05-ARCHITECTURE.md §8` (D.A.7)
- `08-COPY-I18N.md §2.9` `privacy.syncCloud` / `privacy.syncCloudDesc` (v0.2)
- ADR-0002 — Local-first e privacy-by-design

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 9 (2026-10-15) | Placeholder post-audit: vincoli non negoziabili da D.A.7/D.A.12; 8 decisioni aperte da chiudere prima dell'implementazione |