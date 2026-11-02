---
number: 87
title: "Remediation dell'encoding UTF-8 (mojibake/BOM) e del tooling multi-sessione"
date: 2026-11-02
state: 🟡
merged: false
branch: feat/277-remediation-encoding-utf-8-senza-bom-e-m
pr: 0
claim: kilo-HP-ELITEBOOK-c87enc
tags: [devops, remediation, encoding, protocollo]
---

# Sessione 87 — Remediation: encoding UTF-8 e tooling multi-sessione

> **Oggetto**: due problemi emersi nelle Sessioni 85-87, entrambi fraducibili e
> **silenziosi**: (1) la corruzione di encoding prodotta da Windows PowerShell 5.1,
> che aveva gia' fatto danni in `main`; (2) il limite di `apply-merge-state.mjs`, che
> assumeva un file di sessione per PR e aveva lasciato due sessioni senza stato di merge.

## Sintesi

| # | Problema | Root cause | Remediation |
|---|----------|-----------|-------------|
| 1 | **Mojibake + BOM** in file di testo | 5.1 decodifica con la code page ANSI (`Get-Content` senza `-Encoding`) e scrive **con BOM** (`Set-Content -Encoding UTF8`) | gate `check-encoding.mjs` (bloccante in CI e pre-commit), `--fix`, test T1..T7, allowlist, **F9-ter** in AGENTS.md, 4 BOM preesistenti rimossi |
| 2 | `apply-merge-state.mjs` abortava con piu' file di sessione per PR | l'invariante del protocollo e' «una PR = una issue», non «una PR = una sessione» | lo stato di merge viene applicato a **tutti** i file che dichiarano la PR (#275) |

## Cosa e' emerso verificando (Sessione 85-87)

1. **Il danno era gia' in `main`**: i due file di sessione 85 e 86 erano stati riscritti in ANSI
   (40+ punti corrotti ciascuno) dalla PR #273. Rilevato per caso, cercando `Ã|â€|Â`.
2. **Il repository aveva 4 BOM UTF-8** preesistenti, mai notati: `.github/workflows/ci.yml`,
   `.github/workflows/auto-bundle.yml`, `AGENTS.md` e `docs/state/sessions/84-push-race-retry.md`.
   Rimossi in questa sessione.
3. **Tutte le occorrenze di "mojibake" gia' presenti nel repository sono contenuto legittimo**:
   sono i documenti che *descrivono* il problema (F9-bis, ADR-0008 §parsing, `17-DEV-NOTES` P12,
   il DEV-LOG, le lezioni delle sessioni 72 e 86, il test di determinismo che greppa il mojibake).
   Per questo esiste un'**allowlist**: i file che documentano esempi sono in WARN, non in errore —
   rimuoverli significherebbe cancellare la lezione che li ha prodotti.
4. **Lo scan inline in PowerShell 5.1 era esso stesso difettoso**: `git cat-file` restituiva una
   stringa e non dei byte, quindi il cast a `byte[]` falliva 200 volte prima di produrre un
   risultato ("nessun mojibake rilevato") che non valeva niente. **Il controllo dei byte deve
   stare in Node**, non in una shell: e' il principio che ha prodotto il gate.
5. `Set-Content -Encoding UTF8` in 5.1 aggiunge il **BOM**: il file risultava corretto a occhio
   ma con 3 byte in piu' in testa — incompatibile con la convenzione del repo (UTF-8 senza BOM).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-87.1 | Il gate di encoding è **bloccante** in CI e nel pre-commit hook | Un gate advisory è un consiglio: il danno di Sessione 85 è passato perche' nessuno lo guardava |
| D-87.2 | La rilevazione del mojibake è **a coppia** (carattere-guida + carattere di continuazione cp1252), non a elenco di stringhe | Un carattere-guida isolato ("Ã") puo' essere legittimo (un nome proprio); la coppia ("Ã©", "â€”") non lo e' mai: nessun falso positivo sui documenti con accenti italiani |
| D-87.3 | `--fix` riscrive **solo** quando l'inversione e' inequivocabile (testo rovesciato = UTF-8 valido e senza firme residue) | Una riparazione "quasi giusta" e' peggio di nessuna: il file sembra sistemato e resta corrotto |
| D-87.4 | Allowlist esplicita (`scripts/encoding-allowlist.txt`) con il perche' accanto a ogni riga | I documenti che mostrano il mojibake sono la prevenzione della recidiva: toglierli dal gate significa renderli invisibili al controllo |
| D-87.5 | `apply-merge-state.mjs` applica lo stato a **tutti** i file di sessione che dichiarano la PR | Il fatto e' inequivocabile (sono stati mergiati da quella PR); l'abort precedente lasciava le sessioni con «non ancora mergiato» per sempre |
| D-87.6 | Il fix del tooling e' in una PR **separata** dal gate di encoding | Un cambio al tooling con un proprio test non viaggia dentro una PR che ne introduce un altro |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%), restano **9 step**.
Lavoro di **devops/protocollo**: nessuna story di prodotto e' toccata, ma il repository perde una
classe di danno **silenzioso**.

**Cosa e' pronto.**
- `scripts/check-encoding.mjs`: gate read-only con `--staged` e `--fix`; 3 classi di danno
  (BOM, UTF-8 non valido, doppia codifica), allowlist con WARN.
- `scripts/test-encoding-gate.mjs`: 7 scenari (T1..T7), 16 assert — incluso il caso T4, in cui il
  `--fix` deve **riparare davvero** (`Città` ed em-dash ripristinati).
- `.githooks/pre-commit`: INVARIANTE 3 (encoding dei file staged, bloccante).
- `.github/workflows/ci.yml`: 2 step nuovi nel job `gates-docs` (gate + scenario negativo).
- `AGENTS.md` **v1.39**: sezione **F9-ter** (la tabella dei default 5.1 vs 7, le 3 regole
  operative, il gate, l'allowlist) e la riga nella tabella «regola vincolante ⟺ gate».
- `scripts/apply-merge-state.mjs`: applica lo stato di merge a piu' file di sessione (#275).
- 4 BOM preesistenti rimossi (CI, auto-bundle, AGENTS.md, sessione 84).
- `docs/12-DEVOPS.md` §9.10: catalogo dei gate allineato (righe 32-33).

**Cosa manca.** Nulla sul piano della remediation: il gate, il suo test (7 scenari, 16 assert), il
test del tooling multi-sessione (3 scenari, 13 assert) e le istruzioni per gli agenti sono tutti in
posto. Rimane solo la verifica in CI (i gate e i test girano su ogni PR) e la ratifica del merge.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano; aggregatore e
bundle rigenerati nell'ordine vincolante (aggregator → generator).

**Gate di testabilità.** `node scripts/check-encoding.mjs` → 0 errori, 10 WARN in allowlist ·
`node scripts/test-encoding-gate.mjs` → 16 assert, 0 falliti ·
`node scripts/test-apply-merge-state.mjs` → 13 assert, 0 falliti ·
`node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`node scripts/validate-workflows.mjs .github/workflows` → 0 falliti ·
`node scripts/check-aggregate-blocks.mjs` → 0 violazioni ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| **5.1 non è un fallback: è un processo diverso** con default diversi | `Get-Content` e `Set-Content` hanno semantica diversa fra 5.1 e 7: la stessa identica riga di comando corruppe in uno e no nell'altro. E' il motivo per cui il danno e' entrato in `main` **senza errori**: il comando era riuscito |
| Il rilevamento per caso (`Ã|â€|Â`) e' arrivato **dopo** il danno | Il gate che mancava era il vero deliverable: senza, il prossimo file riscritto in ANSI sarebbe tornato in `main` |
| Uno scan fatto con lo strumento sbagliato produce una **falsa risposta** | Lo scan inline in 5.1 ha stampato "nessun mojibake" dopo 200 errori di cast: un controllo che non puo' fallire non e' un controllo |
| I documenti che descrivono il bug sono essi stessi "il bug" per il gate | Servono due regole: il gate distingue **danno** da **contenuto**, e l'allowlist dichiara il perché. Senza il secondo, il primo produce rumore che finisce per essere ignorato |
| Un presupposto non scritto in un tool diventa un **abort silenzioso** a valle | «una sessione per PR» non era nel protocollo: era nel codice. Il merge della PR #273 l'ha reso visibile — due sessioni rimaste «non mergiato» per sempre |

## Documenti aggiornati

- `scripts/check-encoding.mjs`, `scripts/test-encoding-gate.mjs`, `scripts/encoding-allowlist.txt` (nuovi)
- `scripts/apply-merge-state.mjs` (issue #275: piu' file di sessione per PR) + `scripts/test-apply-merge-state.mjs` (T1..T3)
- `.githooks/pre-commit` (INVARIANTE 3), `.github/workflows/ci.yml` (3 step: encoding, test encoding, test merge-state)
- `AGENTS.md` v1.39 (F9-ter + tabella regola/gate), `docs/INDEX.md` (versione e riga AGENTS.md)
- `docs/12-DEVOPS.md` §9.10 (catalogo dei gate: righe 32-33)
- `docs/BUNDLE.md` (rigenerato)
