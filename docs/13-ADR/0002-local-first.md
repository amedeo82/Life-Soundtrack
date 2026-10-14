# ADR-0002 — Local-first e privacy-by-design

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1

## Contesto

Il progetto tratta dati altamente personali (cronologia di ascolto, contesto, inferenze emotive). Il target europeo è sensibile al GDPR. Ogni architettura cloud-first introdurrebbe obblighi legali, costi e rischi di trust.

## Decisione

**Tutti i dati personali risiedono nel browser dell'utente (IndexedDB).** Nessuna autenticazione obbligatoria. Nessuna telemetria. Le uniche comunicazioni di rete possibili sono: (1) arricchimento metadati brani, disattivabile; (2) hub di scrobbling scelti dall'utente; (3) sync cloud opzionale E2E in Fase 2.

## Motivazioni

- La privacy è il differenziale competitivo, non un vincolo
- Zero costi di infrastruttura nel MVP
- Compliance GDPR semplificata: nessun trattamento server-side di PII
- Reversibilità totale: export e cancellazione sono operazioni locali

## Alternative considerate

- **Cloud-first con account**: scartata (costi legali, trust, lock-in)
- **Self-hosted server obbligatorio**: scartata per frizione; resta opzione Docker documentata

## Conseguenze

- Positive: trust, costi, semplicità legale
- Negative: nessun cross-device nel MVP; elaborazione limitata alle risorse del browser
- Mitigazioni: Web Worker e streaming parse per file grandi; sync E2E opzionale in Fase 2
- **IP address**: non persistito di default; conservato SOLO con toggle esplicito `retainIp`; mai inviato in rete; purgabile con `purgeIp()`. Il `country` è sempre derivato (privacy-by-design, vedi 09)

## Collegamenti

- 02-DATA-SCHEMA §8 · 09-PRIVACY-SECURITY (Sessione 6)