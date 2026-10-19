# 16 — Operations runbook + manutenzione DB

> Status: 🟢 APPROVED (Story 0.7, PR #39)
> Spec di riferimento: `05-ARCHITECTURE.md` §11 (App update management), §12 (Database maintenance); `02-DATA-SCHEMA.md` §7 (migrazioni MIG-1..4).

Questo runbook è destinato all'operatore (sviluppatore che mantiene il progetto) e documenta in dettaglio le operazioni di **update management** e **manutenzione del database locale** (IndexedDB via Dexie), incluse diagnosi e remediation di problemi noti.

---

## §1 — Update playbook (05§11)

Le PWA richiedono un ciclo di aggiornamento **esplicito e controllato** perché l'utente non scarica attivamente una nuova versione: il Service Worker aggiorna la cache in background e l'utente può restare bloccato su una versione vecchia (anche con cache buggate).

### 1.1 Version manifest

L'app pubblica un `version.json` su `/version.json` con:

```json
{
  "version": "0.1.0",
  "buildHash": "<git rev-parse HEAD>",
  "releasedAt": "2026-10-19T...Z",
  "minSchemaVersion": 3
}
```

- `version`: versione dal `package.json` di `apps/web`.
- `buildHash`: commit SHA corrente (`git rev-parse HEAD`).
- `releasedAt`: timestamp ISO di generazione.
- `minSchemaVersion`: versione minima di schema DB che il client sa gestire (02-DATA-SCHEMA.md §10 v1.2).

Il manifest è generato in fase di build dallo script `scripts/generate-version.mjs` (richiamato dallo script `build` di `apps/web`):

```
"build": "node ../../scripts/generate-version.mjs && tsc -p tsconfig.json --noEmit && vite build"
```

Il client confronta a ogni boot la versione cached con quella del manifest per decidere se mostrare il banner di update (05-ARCHITECTURE.md §11.1).

### 1.2 Service Worker update lifecycle

Gestito da Workbox (`vite-plugin-pwa`):

1. **Install**: SW nuovo scarica i precached assets in `tempCache`.
2. **Waiting**: SW nuovo aspetta che tutte le tab del SW vecchio siano chiuse.
3. **Activate**: SW nuovo prende il controllo, pulisce `oldCaches`.
4. **Clients claim**: il SW nuovo si annuncia via `clients.claim()` solo se la versione è **soft-compatible** (minor/patch); per major → attende chiusura tab.

### 1.3 Prompt policy (05§11.3)

| Tipo cambio | Comportamento |
|-------------|---------------|
| **Patch** (es. 1.0.0 → 1.0.1) | Auto-apply al prossimo boot, nessun prompt |
| **Minor** (es. 1.0.0 → 1.1.0) | Banner soft: "Nuova versione disponibile" con CTA "Aggiorna ora" / "Più tardi" |
| **Major** (es. 1.x → 2.x) | **Modal bloccante** se c'è una migrazione DB; altrimenti banner come minor |

Il prompt è gestito dall'hook `useAppUpdate()` in `@ls/web/hooks`, che ascolta `serviceWorker.controllerchange` e il custom event `ls:update-available`. La decisione "modal bloccante" è presa da `isBlockingUpdate()` (`@ls/web/lib/versionManifest`) che confronta `updateKind === 'major'` con `currentDbVersion < minSchemaVersion`.

### 1.4 Migrazione DB tra versioni (05§11.4)

Quando una nuova versione di `02-DATA-SCHEMA.md` viene rilasciata:

1. Confronta `currentDbVersion` (letto da `db.verno`) con `expectedDbVersion` (build-time constant).
2. Se `currentDbVersion < expectedDbVersion`: esegue le funzioni di upgrade di Dexie (`02§7` MIG-1..4) in sequenza.
3. Se l'upgrade fallisce: rollback all'ultima versione funzionante via SW + banner "Ripristino versione precedente" (solo per failure di migrazione, NON per failure di feature).

---

## §2 — Maintenance playbook (05§12)

Operazioni di manutenzione che il client deve supportare per garantire salute del DB locale nel tempo. Sono **non-bloccanti** per l'utente: girano in background, con throttling, e notificano l'utente solo se rilevano problemi.

### 2.1 Operazioni standard

| Operazione | Quando | Cosa fa | Costo | Stato |
|------------|--------|---------|-------|-------|
| `recount()` | Dopo ogni import + settimanale | Ricalcola `listenCount` denormalizzati su tracks/artists | O(n listens) | ✅ attivo (Story 0.2) |
| `rekey()` | Dopo enrichment con ISRC/MBID | Promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:`, unisce duplicati | O(n tracks) | ✅ Story 0.7 |
| `orphanCleanup()` | Mensile | Rimuove `tracks`/`artists` non referenziati da `listens` né da `library` | O(n tracks) | ✅ Story 0.7 |
| `indexRebuild()` | Manuale + dopo migrazione | Ricostruisce indici Dexie se corrotti | Lock lungo | ⬚ futuro |
| `fastCheck()` | Ad ogni boot (dev/prod) | Smoke test: DB apribile, schema version corretto, indici funzionanti | < 100ms | ✅ Story 0.7 |
| `quotaCheck()` | Settimanale | `navigator.storage.estimate()` → warning se > 80% | < 50ms | ✅ Story 0.7 |
| `compact()` | Manuale (utente) | Compaction `IDBObjectStore` se supportato | Variabile | ⬚ futuro |

### 2.2 Scheduling

- **On-trigger**: `recount` e `rekey` dopo ogni import (transazione `02§7`) — `recount` attivo (Story 0.2), `rekey` attivo (Story 0.7).
- **Scheduled**: `orphanCleanup`, `quotaCheck` via Web Worker in `requestIdleCallback`, max 5 min/giorno (cumulativo con `05§7.1`) — Story 0.7.
- **Manuale**: `indexRebuild`, `compact` da pulsante in Settings → "Manutenzione DB" (raro) — ⬚ futuro.
- **Boot**: `fastCheck` sempre; se fallisce, l'app entra in read-only mode (`05§5`) — Story 0.7.

### 2.3 Health monitoring (no telemetry, D.A.1)

- I risultati di `fastCheck` / `quotaCheck` sono loggati in `core/logger` localmente (schema `{level, module, msg, ctx}`, nessun PII).
- L'utente vede un badge "Tutto ok" o un banner "Spazio in esaurimento" in Settings → Manutenzione.
- Un contatore anonimo `lastMaintenance: { recount, rekey, orphan, fastCheck }` è mostrato all'utente per trasparenza.
- **Nessun dato** viene inviato a server (coerente con ADR-0002).

### 2.4 API esposte (`@ls/core/db`)

```ts
import { rekey, orphanCleanup, recount, fastCheck, quotaCheck, runHealthCheck } from '@ls/core/db';
```

- `rekey(db)` → `{ promoted, merged, listenedMoved }`
- `orphanCleanup(db)` → `{ tracksRemoved, artistsRemoved }`
- `recount(db)` → `Promise<void>` (già attivo da Story 0.2)
- `fastCheck(db, expectedSchemaVersion)` → `FastCheckResult { ok, schemaVersion, error, durationMs }`
- `quotaCheck()` → `QuotaCheckResult { ok, quota, usage, fillRatio, warning }`
- `runHealthCheck(db, expectedSchemaVersion)` → `DbHealthState { fastCheck, quotaCheck, status }`

---

## §3 — Migrazioni schema (02§7, MIG-1..4)

Le migrazioni sono definite in `02-DATA-SCHEMA.md §7`. Regole di processo:

1. **Mai drop di tabelle utente** (MIG-1).
2. Ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)` con **funzione di upgrade testata** (10-TESTING.md §4.3).
3. Le tabelle derivate (`sessions`, `insights`) sono **ricostruibili** con `recompute()` (MIG-2).
4. I parametri di analisi cambiano `derivedVersion` (MIG-3).
5. I contatori denormalizzati sono ricalcolabili con `recount()` (MIG-4).

Una migration che fallisce **non corrompe il DB**: la transazione Dexie fa rollback automatico. L'utente vede un banner "Aggiornamento DB non riuscito, ripristino versione precedente" (05§11.4).

Schema attuale: **versione 3** (v1 → v2 aggiunge `searchQueries`; v2 → v3 aggiunge `artworkUrl` nullable su `tracks` e `albums`).

---

## §4 — Diagnosi & remediation

### 4.1 fastCheck fallisce (read-only mode)

**Sintomi**: banner persistente "Errore critico, ricarica l'app" (`error.dbCritical`), app in read-only mode (nessuna scrittura accettata).

**Diagnosi**:
1. Aprire DevTools → Console: cercare `[ls:db:health] fastCheck fallito`.
2. Verificare `fastCheck.schemaVersion`: se < `expectedSchemaVersion` (3), serve una migrazione DB.
3. Verificare l'errore: `DB non aperto` (IndexedDB non disponibile, modalità privata Safari) o errore di schema/indici.

**Remediation**:
- Se serve migrazione: ricaricare l'app per permettere l'upgrade automatico di Dexie; se l'upgrade fallisce, il SW effettua il rollback alla versione precedente.
- Se IndexedDB non disponibile: l'utente deve uscire dalla modalità privata o liberare spazio (`quotaCheck` > 80%).

### 4.2 Spazio IndexedDB in esaurimento (quotaCheck > 80%)

**Sintomi**: banner "Spazio IndexedDB in esaurimento: X% utilizzato" in Settings → Manutenzione.

**Diagnosi**: `navigator.storage.estimate()` → `fillRatio > 0.8`.

**Remediation**:
- L'utente può usare `compact()` (quando disponibile) o cancellare dati non necessari.
- L'operatore può verificare quali tabelle occupano più spazio (tracks, listens).

### 4.3 Migrazione DB fallita

**Sintomi**: banner "Aggiornamento DB non riuscito, ripristino versione precedente".

**Diagnosi**: errore durante `db.version(n).upgrade(...)`; Dexie fa rollback automatico della transazione.

**Remediation**:
- Il SW ripristina la versione precedente dell'app.
- L'operatore investiga la funzione di upgrade fallita (vedere `02§7` e i test di migrazione in `packages/core/src/db/__tests__/db.test.ts`).

### 4.4 Duplicati dopo enrichment (canonicalKey fuzzy)

**Sintomi**: stessa traccia presente due volte con `canonicalKey` diverso (`fuzzy:*` vs `isrc:*` o `mbid:*`).

**Diagnosi**: query su `tracks` con stesso `isrc` o `mbid` e `canonicalKey` diversi.

**Remediation**: eseguire `rekey()` che promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:` e unisce i duplicati aggregando `listenCount` e riorientando i `listens.trackId`.

---

## Acceptance criteria (Story 0.7)

- [x] `16-OPERATIONS.md` esiste e referenzia `05§11` e `05§12`.
- [x] Tutte le funzioni di manutenzione hanno test unitari (≥ 80% coverage su `packages/core/db/`).
- [x] `fastCheck` eseguito al boot; failure → read-only mode + banner.
- [x] Update soft (minor) mostra banner; update major mostra modal (quando `requiresDbMigration`).
- [x] Migrazione DB v1→v2 simulata in test passa senza perdita dati.
- [x] Rollback SW in caso di migration failure (test E2E, `rollbackServiceWorker`).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | 2026-10-19 | Prima versione (Story 0.7, PR #39): §1 Update playbook, §2 Maintenance playbook, §3 Migrazioni, §4 Diagnosi & remediation; API `@ls/core/db` (rekey, orphanCleanup, fastCheck, quotaCheck, runHealthCheck); script `scripts/generate-version.mjs`. |
