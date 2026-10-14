# ADR-0001 — PWA come piattaforma primaria

> Status: 🟡 DRAFT (approvazione Boss pending) · Sessione 1

## Contesto

Il prodotto deve raggiungere utenti desktop e mobile con un team di sviluppo piccolo (umano + agenti). Le opzioni: app native separate, desktop-first (Electron/Tauri), web-first (PWA).

## Decisione

**PWA (Progressive Web App) come piattaforma primaria e unica del MVP.** Desktop Tauri e wrapper mobile nativo rinviati a Fase 2 come estensioni opzionali.

## Motivazioni

- Un solo codebase per tutti i form factor
- Nessun app store: distribuzione diretta, aggiornamenti immediati, zero commissioni
- Local-first realizzabile con IndexedDB + Service Worker
- Installabile su desktop e home mobile
- Coerente con privacy-first: nessun intermediario

## Alternative considerate

- **Native mobile first**: scartata per costo doppio e frizione app store in fase di validazione
- **Electron desktop first**: scartata per peso e per target non solo desktop
- **Desktop Tauri first**: rinviata; resta opzione Fase 2 per utenti power (file system, Plex locale)

## Conseguenze

- Positive: velocità di sviluppo, manutenzione singola, privacy
- Negative: push notification e integrazione OS limitate nel MVP; File System Access API non uniforme tra browser
- Mitigazioni: fallback drag&drop per upload file; Tauri in Fase 2 per i casi power-user

## Collegamenti

- 05-ARCHITECTURE §8 · 00-VISION §Perimetro MVP