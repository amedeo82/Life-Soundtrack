# ADR-0003 — Adapter pattern e normalizzazione early

> Status: 🟡 DRAFT (approvazione Boss pending) · Sessione 1

## Contesto

Otto+ sorgenti eterogenee (formati, campi, semantica temporale, edge case). Serviva una strategia per non far degenerare il core in logica per-platform.

## Decisione

**Ogni piattaforma è un adapter indipendente** che implementa l'interfaccia `PlatformAdapter` (05-ARCHITECTURE §4) e produce esclusivamente il formato unificato (02-DATA-SCHEMA). La normalizzazione avviene al parse ("early"): il payload raw **non** è persistito nel DB.

## Motivazioni

- Aggiungere una piattaforma = aggiungere un modulo, senza toccare il core
- Analisi e UI lavorano su un solo schema
- Testabilità: ogni adapter è testabile isolato con fixture
- Spazio: persistere il raw di 200k eventi raddoppierebbe il DB locale

## Alternative considerate

- **Silos per-platform**: scartata (analisi cross-platform impossibili)
- **ETL server-side**: scartata (contraria ad ADR-0002)
- **Persistenza del raw nel DB**: scartata per spazio; il file dell'utente resta fonte di verità e l'import è ri-eseguibile (idempotenza via eventKey)

## Conseguenze

- Positive: core pulito, estensibilità, test semplici
- Negative: perdita di campi platform-specific non mappati; debugging di parse errori richiede il file originale
- Mitigazioni: `ImportRecord.warnings` cataloga gli edge case (E1..E10); log di import conservato; campi futuri aggiungibili con migrazioni

## Collegamenti

- 01-PLATFORMS §5 · 02-DATA-SCHEMA §6-7 · 05-ARCHITECTURE §4