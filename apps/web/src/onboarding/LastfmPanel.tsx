/**
 * Pannello Last.fm — configurazione locale + import via API (Story 1.3).
 *
 * Tre dati, tutti **per-utente** e conservati **solo sul dispositivo**
 * (Dexie, `09-PRIVACY-SECURITY.md` §4):
 * - proxy CORS (D-LF.0): base URL configurato dall'utente. Il progetto non
 *   ne gestisce nessuno: è di fiducia dell'utente e vede le richieste (e la
 *   chiave API) che l'utente stesso sta facendo;
 * - `api_key` (D-LF.1): mai embedded nel bundle, mai nei log;
 * - username Last.fm: dato personale, escluso dal bundle.
 *
 * Senza proxy la card Last.fm resta `disabled` e **zero richieste** vengono
 * fatte (E.LF.7): il percorso **file** della card resta comunque disponibile.
 */
import { useCallback, useEffect, useState } from 'react';
import { LastfmAdapter } from '@core/adapters/lastfm';
import { buildAuthTokenUrl, exchangeSessionKey, parseAuthToken } from '@core/adapters/lastfm/auth';
import { runRemoteImport } from '@core/adapters';
import {
  EMPTY_LASTFM_CONFIG,
  isLastfmConfigured,
  loadLastfmConfig,
  openDb,
  saveLastfmConfig,
  type LastfmConfig,
} from '@core/db';
import type { PrivacySettings } from '@core/schema';
import { useT } from '../i18n';

export interface LastfmPanelProps {
  /** Impostazioni privacy vigenti (05§5): il percorso API le rispetta. */
  privacy: PrivacySettings;
  /** Chiamata al termine di un import riuscito (eventi inseriti). */
  onImported?: (eventsInserted: number) => void;
}

type PanelStatus = 'idle' | 'loading' | 'saved' | 'importing' | 'error';

export function LastfmPanel({ privacy, onImported }: LastfmPanelProps) {
  const t = useT();
  const [config, setConfig] = useState<LastfmConfig>(EMPTY_LASTFM_CONFIG);
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState(0);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [authDone, setAuthDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await openDb();
        const stored = await loadLastfmConfig(db);
        if (!cancelled) {
          setConfig(stored);
          setStatus('idle');
        }
      } catch {
        if (!cancelled) {
          setStatus('idle');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setStatus('saved');
    setMessage(null);
    try {
      const db = await openDb();
      await saveLastfmConfig(db, config);
    } catch {
      setStatus('error');
      setMessage(t('error.generic'));
    }
  }, [config, t]);

  const handleImport = useCallback(async () => {
    if (!isLastfmConfigured(config)) {
      return;
    }
    setStatus('importing');
    setMessage(null);
    setEvents(0);
    try {
      const db = await openDb();
      const adapter = new LastfmAdapter({ username: config.username });
      const summary = await runRemoteImport(
        db,
        adapter,
        {
          endpoint: config.proxyBaseUrl,
          credentials: { apiKey: config.apiKey },
        },
        { privacy, fileName: 'lastfm-api' },
      );
      setEvents(summary.eventsInserted);
      setStatus('idle');
      onImported?.(summary.eventsInserted);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('error.generic'));
    }
  }, [config, onImported, privacy, t]);

  const configured = isLastfmConfigured(config);

  const handleOpenAuth = useCallback(() => {
    if (config.apiKey.trim().length === 0) {
      return;
    }
    // La redirect_uri è **registrata dall'utente** su Last.fm (D-LF.2): la PWA
    // non fa da server (ADR-0002).
    const redirectUri = `${window.location.origin}/`;
    window.open(buildAuthTokenUrl(config.apiKey, redirectUri), '_blank', 'noopener');
  }, [config]);

  const handleConnectSession = useCallback(async () => {
    const token = parseAuthToken(callbackUrl);
    if (!token) {
      setStatus('error');
      setMessage(t('settings.lastfm.authMissingToken'));
      return;
    }
    setStatus('loading');
    try {
      const session = await exchangeSessionKey(config.apiKey, token);
      const next: LastfmConfig = {
        ...config,
        sessionKey: session.sessionKey,
        username: session.username || config.username,
      };
      setConfig(next);
      const db = await openDb();
      await saveLastfmConfig(db, next);
      setCallbackUrl('');
      setAuthDone(true);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('error.generic'));
    }
  }, [callbackUrl, config, t]);

  return (
    <section className="platform-card" data-testid="lastfm-panel">
      <div className="platform-card__header">
        <span className="platform-card__name">Last.fm</span>
        <span className="platform-card__platform-dot" aria-hidden="true" />
      </div>

      <p className="platform-card__instructions">{t('settings.lastfm.hint')}</p>

      <label className="platform-card__instructions" htmlFor="lastfm-proxy">
        {t('settings.lastfm.proxy')}
      </label>
      <input
        id="lastfm-proxy"
        type="url"
        className="input"
        placeholder="https://proxy.example.org"
        value={config.proxyBaseUrl}
        onChange={(e) => setConfig((prev) => ({ ...prev, proxyBaseUrl: e.target.value }))}
        data-testid="lastfm-proxy"
      />

      <label className="platform-card__instructions" htmlFor="lastfm-username">
        {t('settings.lastfm.username')}
      </label>
      <input
        id="lastfm-username"
        type="text"
        className="input"
        value={config.username}
        onChange={(e) => setConfig((prev) => ({ ...prev, username: e.target.value }))}
        data-testid="lastfm-username"
      />

      <label className="platform-card__instructions" htmlFor="lastfm-apikey">
        {t('settings.lastfm.apiKey')}
      </label>
      <input
        id="lastfm-apikey"
        type="password"
        className="input"
        autoComplete="off"
        value={config.apiKey}
        onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
        data-testid="lastfm-apikey"
      />

      <label className="platform-card__instructions" htmlFor="lastfm-shared-secret">
        {t('settings.lastfm.sharedSecret')}
      </label>
      <input
        id="lastfm-shared-secret"
        type="password"
        className="input"
        autoComplete="off"
        value={config.sharedSecret}
        onChange={(e) => setConfig((prev) => ({ ...prev, sharedSecret: e.target.value }))}
        data-testid="lastfm-shared-secret"
      />

      <p className="platform-card__instructions">{t('settings.lastfm.authHint')}</p>

      <label className="platform-card__instructions" htmlFor="lastfm-auth-callback">
        {t('settings.lastfm.authCallback')}
      </label>
      <input
        id="lastfm-auth-callback"
        type="url"
        className="input"
        placeholder="https://…?token=…"
        value={callbackUrl}
        onChange={(e) => setCallbackUrl(e.target.value)}
        data-testid="lastfm-auth-callback"
      />

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleOpenAuth}
          disabled={config.apiKey.trim().length === 0}
          data-testid="lastfm-auth-open"
        >
          {t('settings.lastfm.auth')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void handleConnectSession()}
          disabled={callbackUrl.trim().length === 0}
          data-testid="lastfm-auth-connect"
        >
          {t('settings.lastfm.authConnect')}
        </button>
      </div>

      {authDone && (
        <p className="platform-card__status" aria-live="polite" data-testid="lastfm-auth-saved">
          {t('settings.lastfm.authSaved')}
        </p>
      )}

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void handleSave()}
          data-testid="lastfm-save"
        >
          {t('settings.lastfm.save')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleImport()}
          disabled={!configured || status === 'importing'}
          data-testid="lastfm-import"
        >
          {t('settings.lastfm.import')}
        </button>
      </div>

      {!configured && (
        <p className="platform-card__message" data-testid="lastfm-not-configured">
          {t('settings.lastfm.notConfigured')}
        </p>
      )}
      {status === 'saved' && (
        <p className="platform-card__status" aria-live="polite" data-testid="lastfm-saved">
          {t('settings.lastfm.saved')}
        </p>
      )}
      {status === 'importing' && (
        <p className="platform-card__status" aria-live="polite" data-testid="lastfm-importing">
          {t('settings.lastfm.importing')}
        </p>
      )}
      {status === 'error' && message && (
        <p className="platform-card__message" aria-live="polite" data-testid="lastfm-error">
          {message}
        </p>
      )}
      {events > 0 && (
        <p className="platform-card__counter" aria-live="polite" data-testid="lastfm-events">
          {t('settings.lastfm.imported', { count: events })}
        </p>
      )}
    </section>
  );
}
