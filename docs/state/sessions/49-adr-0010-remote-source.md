---
number: 49
title: "ADR-0010 — Sorgenti remote nel contratto degli adapter"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: "1b2d280135fc8e042881d712d0a229e9b172b531"
merged_date: 2026-10-26
branch: docs/148-adr-0010-remote-source
pr: 152
claim: kilo-HP-ELITEBOOK-lb47
cross_refs: [144, 148]
tags: [docs, adr, adapter, architecture]
---

# Sessione 49 — ADR-0010: sorgenti remote nel contratto degli adapter

## Sintesi

Scrittura dell'ADR che estende il contratto `PlatformAdapter` con il metodo
opzionale `parseRemote?()`, così che la Story 1.3 possa implementare l'adapter
Last.fm, che è la prima piattaforma del perimetro **senza un file** da importare.

Il blocco era reale: `05-ARCHITECTURE.md` §4 è 🟢 APPROVED e prevede solo
`detect(input: File | Blob)` e `parse(input: File | Blob)`. Last.fm non ha un
export utilizzabile dall'app, quindi il suo adapter non avrebbe avuto un input
valido da passare a `parse()`.

## Trigger

Issue #148 (aperta in Sessione 47), sbloccata dalla decisione del Boss
(D-LF.8: metodo opzionale, non interfaccia separata).

## Decisione

**Estendere `PlatformAdapter` con un metodo opzionale `parseRemote?()`** che
consuma una nuova struttura `RemoteSource`:

```typescript
interface RemoteSource {
  endpoint: string;
  credentials?: { apiKey?: string; sessionKey?: string };
  pagination?: { limit?: number; from?: number; to?: number };
  headers?: Record<string, string>;
  signal?: AbortSignal;
}
```

Otto vincoli fissati (V1-V8): il metodo è opzionale (gli adapter file-only non
lo implementano), il percorso remoto produce **gli stessi `RawListenEvent`** del
percorso file (pipeline riusata invariata), il payload raw non è persistito,
nessun segreto è embedded nel bundle, nessun backend gestito dal progetto,
`AbortSignal` per la cancellazione, il rate limiting è responsabilità dell'adapter
(ogni piattaforma ha limiti diversi), "sorgente irraggiungibile" è un errore
**recuperabile**.

Sette alternative considerate e motivate (A1-A7): interfaccia separata, input
union, adapter HTTP generico, materializzazione in `Blob`, backend gestito,
estensione totale del contratto, e il fallback "solo import via file".

## Il punto che merita attenzione nel review

**Il codice errore `SOURCE_UNREACHABLE` tocca il contratto di errore dichiarato in
`05§4`**, che dichiara quattro codici tutti orientati al file. Un proxy assente o
irraggiungibile non è nessuno di quelli: `INVALID_FORMAT` mentirebbe, perché non è
un problema di formato. La proposta dell'ADR è aggiungere un quinto codice con
`recoverable: true` — **la ratifica di questo punto è parte del merge**.

Alternativa considerata: riusare `INTERNAL` o aggiungere il caso a `TRUNCATED`
(anch'esso orientato al file). Scartate perché renderebbero indistinguibili
"file malformato" e "proxy rotto", che richiedono azioni opposte dall'utente
(correggere il file vs. configurare il proxy).

## File toccati

| File | Cosa fa |
|------|---------|
| `docs/13-ADR/0010-remote-source-adapter.md` | **nuovo** — l'ADR (13 KB) |
| `docs/05-ARCHITECTURE.md` | §4.1 "Sorgenti remote" nuova; `ParseOptions` estratto come tipo nominato; `RemoteSource` nella forma del contratto; codice `SOURCE_UNREACHABLE` nella tabella degli `AdapterError`; versione 1.0 → 1.1; changelog |
| `docs/INDEX.md` | Riga 05 aggiornata (v1.1), riga 13 aggiornata (0001-0010), conteggio documenti APPROVED |
| `scripts/generate-bundle.ps1` | `$files` += il nuovo ADR |
| `docs/state/sessions/49-adr-0010-remote-source.md` | **nuovo** — questa sessione |
| `docs/state/_index.md` | Riga della sessione 49 nella tabella di migrazione |
| `docs/11-BACKLOG.md` | Story 1.3: la riga sul blocco ADR-0010 riflette lo stato reale |
| `docs/BUNDLE.md` | rigenerato |

## Verifica

- `pwsh scripts/generate-bundle.ps1 --check` → exit 0
- `pwsh scripts/aggregate-state.ps1 --check` → drift atteso (solo il blocco
  `AGGREGATE-BUNDLE-INVENTORY`: i due nuovi file della PR)
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati

## Esito post-merge

Ratificato dal Boss al merge della PR #152 (`1b2d280`). Promozione a **🟢 APPROVED
v1.0** nella PR di doc-sync successiva (stesso pattern della spec ListenBrainz,
PR #147): **nessuna modifica di contenuto**, tranne il punto aperto 1 che era
esplicitamente subordinate alla ratifica — `SOURCE_UNREACHABLE` con
`recoverable: true` entra nel contratto (`05§4`).

La story 1.3 ha così il suo ultimo blocco architetturale risolto: la spec
Last.fm (#144) è ora scrivibile, perché il contratto che deve consumare è
ratificato.

## Lesson learned

| # | Osservazione |
|---|----------------|
| 49-1 | **Un contratto nato da un caso specifico va esteso quando emerge il secondo caso, non prima.** `parse(input: File \| Blob)` era completo per tre piattaforme su tre: la sua forma *file-only* non era un difetto, era una descrizione accurata del mondo in cui era nato. Diventa insufficiente quando compare un quarto caso — e la risposta non è rifare il contratto, ma **aggiungere il caso mancante senza rompere i precedenti**. Il metodo opzionale è la forma minima di quella aggiunta: gli adapter esistenti non vengono toccati, quindi il rischio di regressione sulle story già consegnate è zero |
| 49-2 | **Un'estensione del contratto eredità i suoi errori.** I quattro codici di `AdapterError` erano tutti orientati al file, e il caso "proxy irraggiungibile" non ne aveva uno adatto. Reusarne uno ("`INVALID_FORMAT`") avrebbe funzionato tecnicamente e mentito semanticamente: l'utente avrebbe ricevuto "formato non valido" per un problema di rete, e la remediation sbagliata. Il codice errore è parte del contratto quanto la firma del metodo — merita la stessa attenzione |
| 49-3 | **Estendere il contratto significa estenderne la tassonomia.** Un contratto che cresce di un caso deve crescere anche degli stati che il nuovo caso introduce (qui: una classe di errore, e il concetto stesso di "non raggiungibile" che non esisteva). Aggiungere il metodo senza la tassonomia avrebbe lasciato un buco nei casi d'errore — il tipo di buco che si scopre in produzione, non in review |

## Cross-refs

- **#148** — issue di questo ADR, chiusa dalla PR di questa sessione
- **#144** — spec Last.fm, sbloccata da questo ADR
- `docs/13-ADR/0003-adapter-pattern.md` — il pattern che l'estensione preserva
- `docs/05-ARCHITECTURE.md` §4.1 — la sezione che l'ADR introduce
