# Checklist: rendere pubblico il repository

> Documento operativo. Va eseguito **dopo** il merge della PR di hardening (#310).
> L'ordine è vincolante: la branch protection si abilita **dopo** il flip (su
> repository privato con piano Free non è disponibile), e il tag di release
> serve **dopo** che il repository è pubblico, perché l'offerta AGPL §13
> («il sorgente corrispondente è identificato dal tag git nella pagina
> Releases») è soddisfatta dal tag solo se il repository è leggibile da chiunque.

## Stato al momento della consegna

| Verifica | Esito |
|----------|-------|
| Segreti in 689 commit | **0** |
| PII reale nei file tracciati | **0** |
| IP routable reali nei fixture | **11 → 0** (range RFC 5737) |
| Gate nuovi (bloccanti, fail-closed, con scenario negativo) | **2** |
| Workflow con guard di fork | **3 su 3** |
| CI | **17/17 check verdi** sulla PR #310 |
| Struttura CI | **invariata**: 15 job, 38 → 40 step |
| Gate locali | **tutti verdi** |

---

## Passo 1 — rendere pubblico il repository

Da GitHub: **Settings → General → Danger Zone → Change visibility → Public**.

Oppure via API:

```bash
gh api -X PATCH repos/amedeo82/Life-Soundtrack -f private=false
```

**Cosa succede subito dopo:**

- ✅ **I minuti Actions diventano illimitati e gratuiti.** Il pool da 2.000
  minuti/account non si applica ai repository pubblici. Il problema economico
  che aveva bloccato lo sviluppo (1.802/2.000 minuti, reset il 1° dicembre)
  **scompare**: niente più blocco a fine quota, niente più overage.
- ✅ **La branch protection diventa disponibile** su piano Free per i repository
  pubblici. È il vero motivo per cui il flip conviene: fino ad ora i 16 job
  della CI **non bloccavano alcuna merge** (403 su
  `branches/main/protection`), perché erano un *report*, non un gate.
- ✅ **L'offerta AGPL §13 diventa fruibile.** L'app dichiara già
  `github.com/amedeo82/Life-Soundtrack` nella schermata About
  (`apps/web/src/components/About.tsx:74`): da privato quel link non portava
  nessuno al sorgente.
- ⚠️ **Da questo momento chiunque può leggere tutto**: 689 commit, 141
  documentazione, 194 file di bundle. L'email personale nei 252 commit
  iniziali diventa visibile (decisione assunta: l'identità è già pubblica
  nel profilo e nel contenuto; `.mailmap` normalizza l'attribuzione).

## Passo 2 — attivare la branch protection (subito dopo il flip)

> **Stato: applicato il 2026-11-05 (issue #311).** La sezione originale della checklist
> conteneva tre cose che, misurate sul repository reale, **non** erano applicabili così
> come scritte. Il blocco sotto è conservato per referenza e **non è più eseguibile**:
> cosa è stato applicato davvero è nella sottosezione «Cosa è stato applicato davvero».

### La versione originale della sezione (superata — non eseguire)

Ora disponibile. Da GitHub: **Settings → Branches → Add rule**, oppure:

```bash
gh api -X POST repos/amedeo82/Life-Soundtrack/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / quality"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Impostazioni e perché:

| Impostazione | Valore | Motivo |
|--------------|--------|--------|
| `required_status_checks.contexts` | `CI / quality` | il check aggregatore fail-closed: fallisce se **qualsiasi** job parallelo è fallito, annullato o saltato (`docs/12-DEVOPS.md` §9.10). È il check giusto da richiedere, non i singoli job |
| `strict` | `true` | il branch deve essere aggiornato con `main` prima del merge: senza, una PR verde su un base vecchio si mergea su un base diverso |
| `required_approving_review_count` | `1` | l'unico revisore è il project owner: con `enforce_admins: true` la regola vale anche per lui |
| `required_linear_history` | `true` | i merge commit non servono e confondono la ricostruzione della history |
| `allow_force_pushes` / `allow_deletions` | `false` | il protocollo vieta il force-push su `main`; qui diventa **impossibile**, non solo vietato |

> Con `enforce_admins: true` nessuno — nemmeno il titolare del repository —
> può mergiare una PR senza review e senza `CI / quality` verde.

### Cosa è stato applicato davvero (2026-11-05, issue #311)

| Impostazione | Valore applicato | Perché |
|--------------|------------------|--------|
| Endpoint | **ruleset** `main-protection` (id `26614787`), non la classic branch protection | il token OAuth della CLI (`gho_`, scope `repo`) riceve **404** su `POST /branches/main/protection`: l'endpoint chiede il permesso *Administration*, che un token OAuth non ottiene. La ruleset è creabile con lo stesso token e applica le stesse garanzie |
| `required_status_checks` | contesto **`quality`**, `strict: true`, `integration_id: 15368` | il contesto richiesto è il **nome del check run** (il `job.name`), non la coppia `workflow / job` che si vede nella UI. Il check run del job aggregatore si chiama `quality` (`GET /commits/<sha>/check-runs`). Con `CI / quality` la regola sarebbe **soddisfacibile da nessuna run** → ogni merge resterebbe bloccato per sempre |
| `required_approving_review_count` | **0** | con `1` il repository è **congelato**: l'unico account GitHub è anche l'autore di ogni PR (gli agenti usano l'account del project owner) e GitHub vieta l'auto-approvazione. Restano enforced: PR + check `quality` verde + branch aggiornato |
| Nessun bypass per gli admin | `bypass_actors` = **solo** la deploy key | l'owner resta vincolato come tutti gli altri; l'unica eccezione è il writer post-merge |
| `required_linear_history` | attivo | i merge commit non sono più ammessi: **le PR si mergiano con squash** |
| `non_fast_forward` / `deletion` | attivi | niente force push, niente cancellazione di `main` |
| Bypass actor | deploy key `post-merge-writer` (id `168877742`, write) | il writer post-merge è l'unico scrittore di `main` (ADR-0013) e il `GITHUB_TOKEN` **non può** bypassare una ruleset (GitHub: *"Actor GitHub Actions integration must be part of the ruleset source or owner organization"*) |

### Il writer post-merge dopo la protezione

`post-merge.yml` autentica il checkout con la deploy key `post-merge-writer`
(`secrets.WRITER_SSH_KEY` + `secrets.WRITER_SSH_KNOWN_HOSTS`) invece che con il
`GITHUB_TOKEN`: le chiamate API continuano a usare il `GITHUB_TOKEN` (serve
`pull-requests: read`), ma il **push** su `main` passa dalla chiave, che è l'unico
bypass actor. Con il `GITHUB_TOKEN` il push verrebbe respinto con `GH013`.

**Verifica eseguita** (branch sonda `protection-probe`, con una ruleset identica, poi
rimosso): push diretto come owner/admin → **respinto** (`GH013`: *"Changes must be made
through a pull request"* + *"Required status check \"quality\" is expected"*); push diretto
come deploy key → **accettato** (*"Bypassed rule violations"*).

## Passo 3 — creare il primo tag di release

L'offerta AGPL §13 nel NOTICE dice: «il sorgente corrispondente a una release
è identificato dal tag git nella pagina Releases». Nel repository non esiste
ancora **nessun tag e nessuna release** (verificato: `gh api .../releases`
→ `0`). Finché la pagina Releases è vuota, l'offerta è formale.

```bash
git tag -a v0.1.0 -m "v0.1.0 — prima release pubblica (AGPL-3.0)"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes "Prima release pubblica. Sorgente completo: AGPL-3.0."
```

> Il tag va creato **dopo** il flip: fino a quel momento il sorgente non è
> scaricabile da chiunque, quindi il tag non renderebbe l'offerta soddisfacibile.

## Passo 4 — metadata del repository (opzionale ma raccomandato)

```bash
gh repo edit amedeo82/Life-Soundtrack \
  --description "Life Soundtrack — la colonna sonora della tua vita, finalmente leggibile. PWA local-first, privacy-first (AGPL-3.0)." \
  --homepage "https://github.com/amedeo82/Life-Soundtrack#readme" \
  --add-topic pwa --add-topic local-first --add-topic privacy \
  --add-topic music --add-topic monorepo --add-topic react \
  --add-topic typescript --add-topic pnpm --add-topic agpl
```

Ora c'è solo il topic `typescript`. I topic sono il modo in cui GitHub rende il
repository discoveribile.

## Passo 5 — opzionale: sicurezza e automazioni

- **Dependabot alerts**: si attivano automaticamente sui repository pubblici
  (Settings → Code security → Dependabot). Segnalerà vulnerabilità delle
  dipendenze npm.
- **Code scanning**: Settings → Code security → Code scanning → Enable. Su
  repository pubblico è gratuito (CodeQL).
- **Secret scanning**: su repository pubblico è disponibile e segnala
  credenziali committate per errore. Il gate `check-fixtures-privacy.mjs`
  copre i **fixture**, non tutti i file: la secret scanning copre il resto.
- **Discussions**: disattivate per ora. Attivarle solo se servono (il
  protocollo del repository non le usa).

---

## Cosa NON fare

| Azione | Perché no |
|--------|-----------|
| **Non riscrivere la history** per rimuovere l'email | cambierebbe tutti gli SHA: i 38 riferimenti `merged_commit` in `docs/state/` punterebbero a commit inesistenti e il gate fail-closed `check-merge-state.mjs` renderebbe `main` rosso. Richiederebbe un force-push su `main`, vietato dal protocollo. Decisione già assunta (issue #309) |
| **Non disattivare `pull_request` in favore di `pull_request_target`** | `pull_request_target` gira con i permessi del branch BASE ma con il codice del fork: è la classica *pwn request*. I guard di fork aggiunti in #310 rendono `pull_request` sicuro |
| **Non rimuovere i guard di fork dai workflow** | con il repository pubblico chiunque può aprire una PR da un fork: `post-merge.yml` (`contents: write`) scriverebbe su `main`, `auto-status-done.yml` (`issues: write`) transizionerebbe issue arbitrarie |
| **Non rimuovere il check `quality` (aggregatore) dalla ruleset `main-protection`** | è l'aggregatore fail-closed: richiedere i singoli job lascerebbe passare una PR con un job saltato. Il contesto richiesto è il **nome del check run** (`quality`), non la coppia `CI / quality` mostrata nella UI |
| **Non impostare un budget $0** su Actions | blocca le run a quota esaurita = sviluppo bloccato. Su repository pubblico i minuti sono gratuiti: il budget non serve più |

## Verifica finale (dopo il flip)

```bash
# il repository è pubblico?
gh repo view amedeo82/Life-Soundtrack --json isPrivate --jq .isPrivate   # atteso: false

# la protezione di main è attiva? (ruleset, non endpoint classic)
# L'endpoint GET /rulesets/{ruleset_id} accetta solo l'id numerico; il nome non risolve.
# Prima risolviamo l'id per nome, poi interroghiamo la ruleset.
RULESET_ID=$(gh api repos/amedeo82/Life-Soundtrack/rulesets --jq '.[] | select(.name=="main-protection") | .id')
gh api "repos/amedeo82/Life-Soundtrack/rulesets/$RULESET_ID" \
  --jq '{enforcement, target, checks: [.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context], reviews: [.rules[] | select(.type=="pull_request") | .parameters.required_approving_review_count], bypass: [.rules[] | select(.type=="pull_request") | .parameters.bypass_actors[].actor_id]}'

# il tag di release esiste?
gh release list --repo amedeo82/Life-Soundtrack

# il link AGPL §13 dell'app risolve?
curl -sI https://github.com/amedeo82/Life-Soundtrack | head -1   # atteso: HTTP/2 200
```

> `gh api repos/.../branches/main/protection` **non** è il comando di verifica: con un
> token OAuth l'endpoint classic non è amministrabile (404) e la protezione applicata è
> una **ruleset**. Il comando sopra è quello che riflette lo stato reale.

## Rollback

Il flip è reversibile: Settings → Change visibility → Private. Ma **non è
senza prezzo**:

- la branch protection **non è disponibile** sui repository privati con piano
  Free → si perde (reconfigurabile a mano al prossimo flip). Con il public
  flip la protezione è stata applicata come **ruleset** `main-protection`
  (l'endpoint classic non è amministrabile con il token OAuth della CLI)
- la **deploy key** `post-merge-writer` e i secret `WRITER_SSH_KEY` /
  `WRITER_SSH_KNOWN_HOSTS` restano configurati: sono l'unico bypass actor
  della ruleset e servono al writer post-merge. Se la ruleset viene rimossa,
  il writer torna a poter spingere con il `GITHUB_TOKEN` (e a riprovare i
  secret, che **non** andrebbero mai committati)
- i minuti Actions tornano a essere contati sul pool da 2.000/account
- la history resta comunque esposta: chi ha già clonato o scaricato i file
  durante il periodo pubblico li ha ancora
