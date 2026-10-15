# 12 — DevOps, Deployment & Security

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 8
> Vincolante per: configurazione CI/CD, Docker, hosting, security headers

---

## 1. Principi DevOps

1. **Static-first**: Essendo un'app PWA local-first, il deployment è essenzialmente hosting statico. Niente backend complesso nel MVP.
2. **Riproducibilità**: Ogni build deve essere identica e verificabile tramite CI.
3. **Self-hosting friendly**: Fornire Docker out-of-the-box per gli utenti che vogliono ospitare l'app sul proprio NAS/server.
4. **Security by default**: Content Security Policy (CSP) strict, dipendenze aggiornate, nessun dato sensibile negli artifact.

---

## 2. CI/CD Pipeline (GitHub Actions)

La pipeline si attiva su ogni `push` a `main` e su ogni `pull_request`.

### 2.1 Workflow: `ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm run lint

      - name: Run type check
        run: pnpm run type-check

      - name: Run tests
        run: pnpm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          fail_ci_if_error: true

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build PWA
        run: pnpm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: pwa-build
          path: apps/web/dist/
```

### 2.2 Regole di Merge
- Richiede almeno 1 review approvata (da `@amedeo82` o collaboratore).
- Tutti i check CI devono essere verdi (✅).
- Nessun file `fixtures/` può contenere pattern di email o IP reali (controllo tramite script pre-commit o CI).

---

## 3. Containerizzazione (Self-Hosting)

Per gli utenti che desiderano ospitare Life Soundtrack sul proprio server (es. Raspberry Pi, NAS), forniamo un'immagine Docker leggera.

### 3.1 `Dockerfile` (Multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Serve (Nginx)
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.2 `docker-compose.yml`

```yaml
version: '3.8'
services:
  life-soundtrack:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
    # Nessun volume necessario per l'app stessa, i dati restano nel browser dell'utente finale
    # Se si vuole persistere i log di nginx:
    # volumes:
    #   - ./nginx-logs:/var/log/nginx
```

---

## 4. Strategia di Deployment

### 4.1 Hosting Pubblico (Consigliato per MVP)
- **Piattaforma**: Vercel o Netlify.
- **Motivo**: Supporto nativo per PWA, HTTPS automatico, CDN globale gratuito, zero configurazione server.
- **Configurazione**:
  - Build command: `pnpm run build`
  - Output directory: `apps/web/dist`
  - Environment variables: Nessuna richiesta per il MVP (local-first).

### 4.2 Custom Domain
- Configurare il dominio (es. `life-soundtrack.app` o `lifetrack.audio`) con DNS pointing a Vercel/Netlify.
- Forzare HTTPS (HSTS abilitato di default dalle piattaforme).

---

## 5. Security & Headers

Anche se l'app è local-first, il server che la distribuisce deve essere sicuro.

### 5.1 Content Security Policy (CSP)
Da configurare in `nginx.conf` o nelle impostazioni di Vercel/Netlify (`vercel.json` o `_headers`):

```text
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'wasm-unsafe-eval' https://api.musicbrainz.org; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  connect-src 'self' https://api.musicbrainz.org https://freqblog.com; 
  worker-src 'self' blob:;
  frame-ancestors 'none';
```
*Nota*: `'wasm-unsafe-eval'` è necessario per Essentia.js (WebAssembly). `connect-src` limita le chiamate di rete solo ai servizi di arricchimento esplicitamente approvati.

### 5.2 Altri Headers di Sicurezza
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(), camera=(), geolocation=()` (Disabilita accesso a hardware sensibile non necessario).

---

## 6. Monitoraggio & Errori

- **Nessun tracking utente**: Non installare Google Analytics, Mixpanel, o simili.
- **Error Reporting**: Usare Sentry *solo* per errori di crash dell'applicazione (JS errors), configurato per **anonimizzare** automaticamente qualsiasi dato (no PII, no URL con parametri sensibili).
- **Uptime**: Monitoraggio base tramite GitHub Actions o UptimeRobot sul dominio pubblico.

---

## 7. Checklist Pre-Lancio

Prima di rendere il repository pubblico o il sito accessibile, verificare:

### Codice & Build
- [ ] `pnpm run lint`, `pnpm run type-check`, `pnpm run test` passano senza errori.
- [ ] Coverage test ≥ 80% per `packages/core`.
- [ ] Build PWA genera un `dist/` funzionante e service worker registrato.
- [ ] Nessun `console.log` con dati sensibili lasciato nel codice.

### Sicurezza & Privacy
- [ ] CSP configurata e testata (nessun blocco di risorse legittime).
- [ ] Tutti i security headers sono attivi (verificabili con securityheaders.com).
- [ ] I fixture di test (`fixtures/`) contengono SOLO dati sintetici.
- [ ] Privacy Policy e Disclaimer inferenze sono visibili e accessibili nell'app.

### Documentazione
- [ ] `README.md` ha istruzioni chiare per sviluppo e self-hosting.
- [ ] `AGENTS.md` è aggiornato e punta ai documenti corretti.
- [ ] Licenza del progetto definita e file `LICENSE` presente (es. MIT o AGPL-3.0).

### UX & Accessibilità
- [ ] L'app è installabile come PWA su mobile e desktop.
- [ ] Navigazione da tastiera funzionante.
- [ ] Contrasti colori verificati (WCAG AA).
- [ ] `prefers-reduced-motion` rispettato.

---

## 8. Roadmap Post-Lancio (Fase 2+)

- [ ] Implementazione Sync Cloud E2E Encrypted (opzionale).
- [ ] Desktop App nativa tramite Tauri 2.0.
- [ ] Adapters per piattaforme aggiuntive (Deezer, Tidal, Qobuz).
- [ ] Supporto multilingua completo (aggiunta di ES, DE, FR).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 8 | Prima versione completa |
