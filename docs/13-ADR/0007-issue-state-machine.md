# ADR-0007 — Macchina a stati completa delle issue (status:* post-claim)

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 19 (2026-10-17)
> Decisioni approvate dal project owner in sessione interattiva (issue #13).

## Contesto

ADR-0006 ha definito il protocollo di claim (label `in-progress` + commento `claim:`) per gli stati **⬚ candidato → 🟡 claimato → ↩️ rilasciato**, ma **non codifica gli stati successivi al rilascio del claim** (PR aperta, PR mergata, PR rifiutata, story bloccata da dipendenza). Conseguenza strutturale: la query `gh issue list --state open --label agent-ready` continua a proporre issue la cui PR è già in `main`.

**Verifica del 2026-10-17**: tutte le 6 PR mergate nel repo (`PR #1`, `#2`, `#3`, `#4`, `#8`, `#12`) hanno `closingIssuesReferences` vuoto — nessuna clausola `Closes #N` nel body. L'issue **#11** stessa — quella che definiva il claim protocol — è rimasta `OPEN` con label `agent-ready` fino al cleanup di oggi, nonostante `PR #12` (`2891cb5`) fosse merged. Issue **#5/#6/#7** restano invece correttamente in `agent-ready` perché le rispettive PR non sono ancora state aperte. Il problema è sistematico ma limitato alla fase "post-claim": il protocollo ADR-0006 funziona finché la issue è in volo.

Thread di analisi completo: issue #13 (aperta e chiusa come `agent-ready` in S19 per essere il contenitore del lavoro).

## Decisione

Estendiamo il protocollo di claim con una famiglia di label **`status:*`** da applicare al posto di `agent-ready` quando l'issue esce dal ciclo di lavorazione. Le label sono additive (nessuna sostituzione forzata) e mutuamente esclusive con `agent-ready`: un'issue che ha `status:*` non è candidabile per claim.

| Label | Stato equivalente | `agent-ready`? | Issue aperta? |
|-------|-------------------|----------------|---------------|
| `agent-ready` (da sola) | ⬚ candidato | sì | sì |
| `agent-ready` + `in-progress` | 🟡 claim attivo (ADR-0006) | sì | sì |
| `status:in-review` | 👀 PR aperta, in attesa di review | **no** | sì |
| `status:done` | ✅ PR merged & validata | **no** | **chiusa** |
| `status:wontdo` | ❌ PR rifiutata / scope cancellato | **no** | **chiusa** |
| `status:blocked-other` | 🛑 Bloccata da dipendenza (story da completare prima) | **no** | sì |

### Regole di transizione

1. **Claim** (ADR-0006): l'agente in claim attivo aggiunge `in-progress`. Nessuna `status:*`. Lo stato interno al backlog è 🟡 IN PROGRESS.
2. **Apertura PR**: appena l'agente apre la PR, **rimuove `agent-ready`** e **aggiunge `status:in-review`**. La query candidati cessa di proporla. Issue resta aperta.
3. **Merge della PR**:
   - Il body della PR contiene il campo **`Closes #N`** (convenzione rinforzata in `AGENTS.md` §"📝 Checklist di auto-revisione PR").
   - GitHub auto-chiude l'issue al merge.
   - L'agente che applica il **gate D.12.1 post-merge doc-sync** verifica che l'issue sia chiusa e abbia `status:done`. Se manca, lo aggiunge prima del commit di follow-up (o nel body del merge commit se D.12.1 è soddisfatto).
4. **PR rifiutata (close senza merge)**: l'agente aggiunge `status:wontdo` e chiude l'issue con commento motivato (riferimento al PR, motivazione del rifiuto).
5. **Blocked da dipendenza**: l'agente o il project owner aggiunge `status:blocked-other` rimuovendo `agent-ready`. Issue resta aperta; quando la dipendenza è risolta, l'agente rimuove `status:blocked-other` (e, se la issue deve tornare lavorabile, riapre la questione della spec).
6. **`needs-spec` è ortogonale** (vedi `AGENTS.md` §"🔖 Sistema di issue e label"): un'issue può essere contemporaneamente `needs-spec` (manca la specifica) e con `status:blocked-other` (dipendenza esterna) — le due label convivono senza esclusione.

### Query candidati aggiornata

Da (query "vecchia"):

```bash
gh issue list --state open --label agent-ready --limit 20 --json number,title,labels
```

a (query "nuova", esclude qualsiasi issue che abbia una label che inizia con `status:`):

```bash
gh issue list --state open --label agent-ready --limit 20 --json number,title,labels \
  | jq '[.[] | select(([.labels[].name] | any(startswith("status:")) | not))]'
```

Per mutua-esclusione `agent-ready` / `status:*`, le due clausole sono logicamente equivalenti in condizioni normali. La forma con `jq` è **robusta** se mai una issue portasse entrambe le label (errore di etichettatura) o se si vuole filtrare via anche le issue che hanno solo `status:*` senza `agent-ready` (es. `status:blocked-other` per riesame).

### Pattern `Closes #N` (rinforzo)

Ogni PR che risolve un'issue deve contenere **`Closes #N`**, **`Fixes #N`** o **`Resolves #N`** nel body (GitHub li riconosce come keyword e chiude automaticamente l'issue al merge). La convention è documentata in `AGENTS.md` §"📝 Checklist di auto-revisione PR" come punto obbligatorio.

## Alternative considerate

- **Solo chiusura al merge, senza label esplicite**: scartata — perde la distinzione tra `merged+done` (lavoro accettato) e `merged+awaiting-review` (gate D.12.1 ancora da completare). Inoltre non distingue `rifiutato` da `completato`.
- **GitHub Projects V2 con colonne Todo/InProgress/InReview/Done/Rejected**: scartata retroattivamente — il repo non ha Projects abilitato e l'introduzione di board aggiungerebbe una dipendenza UI non necessaria per sole 4 etichette. Resta un'opzione per il futuro se il volume di issue dovesse giustificarlo.
- **Una sola label `done` per qualsiasi esito**: scartata — perde l'informazione di "perché l'issue è chiusa/comunque uscita dal ciclo" (`wontdo` vs `done` vs `blocked-other`). Rende le query di audit ("quante issue di tipo rifiutato abbiamo avuto nel mese?") impossibili.

## Conseguenze attese

- **Positive**: la query candidati cessa di essere ambigua (`agent-ready` ∩ `not has status:*`); la history di un'issue conserva lo stato finale `status:done` (ricercabile con `gh issue list --label status:done`); `release:` di ADR-0006 resta intatto (le label `in-progress` e `status:*` sono su piani distinti); il pattern `Closes #N` diventa standard e abilita il cross-link GitHub (lista PR che hanno chiuso l'issue visibile nella sidebar).
- **Negative**: richiede che gli agenti rispettino la sequenza claim → in-review → done/wontdo a ogni PR; una regressione (issue rimasta OPEN con `agent-ready` dopo merge) resta facile da commettere ma è altrettanto facile da diagnosticare.
- **Mitigazioni**: gate D.12.1 (post-merge doc-sync) verifica `status:done`; autocheck futuro proposto `gh issue list --state open --label agent-ready --json number | xargs -I{} gh pr list --search {} --state merged` per trovare PR aperte collegate a issue ancora `agent-ready` (per ora check manuale del reviewer).

## Riferimenti

- `AGENTS.md` §"📦 Macchina a stati delle issue (status:*)" — sezione nuova, spec operativa
- `AGENTS.md` §"🚀 Primo task di un agente" — query candidati aggiornata con `jq`
- `AGENTS.md` §"📝 Checklist di auto-revisione PR" — campo `Closes #N` reso obbligatorio
- `AGENTS.md` §"🔖 Sistema di issue e label" — tabella label estesa con `status:*`
- `docs/11-BACKLOG.md` §"Stato di una Story" — legenda estesa (v1.4)
- Issue #13, Sessione 19 in `docs/SESSIONS.md`

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 19 (2026-10-17) | Primo rilascio: 4 label `status:*`, transizioni claim → in-review → done/wontdo, query candidati con `jq`, pattern `Closes #N` obbligatorio, retro-compatibile con ADR-0006 (claim-first e TTL invariati) |
