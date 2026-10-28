/**
 * Pannello scrobbling — selettore per-hub, modalità del proxy e coda di invio
 * (Story 1.5, `20-SCROBBLING-HUB.md` v1.0 §13.1).
 *
 * Tre cose, tutte locali e per-utente:
 * - **selettore per-hub** (U-SH.1): default vuoto → nessun invio; togliere un
 *   hub svuota la sua coda (P-SH.4);
 * - **modalità del proxy** (D-SH.14): `solo lettura` (default) / `lettura +
 *   scrittura`. Senza dichiarazione esplicita l'app **non tenta** la scrittura
 *   su Last.fm: molti proxy inoltrano solo GET;
 * - **vista della coda** (U-SH.5): quante righe sono in attesa, in corso,
 *   inviate o fallite.
 *
 * Il pannello non invia nulla da solo: l'invio parte dal ciclo della coda
 * (`runScrobbleCycle`), che il pannello può avviare a richiesta.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  countScrobbleQueue,
  loadLastfmConfig,
  openDb,
  saveLastfmConfig,
  type LastfmConfig,
  type LastfmProxyMode,
  type ScrobbleOutboxStatus,
} from '@core/db';
import { enqueueEligibleListens, getScrobbleSink } from '@core/adapters/scrobble';
import { runScrobbleCycle } from '@core/adapters/scrobble/sender';
import type { ScrobbleHubId } from '@core/schema';
import { useT } from '../i18n';

export interface ScrobblePanelProps {
  /** Hub abilitati (toggle per-hub, `PrivacySettings.scrobbleHubs`). */
  hubs: ScrobbleHubId[];
  /** L'utente ha cambiato il set di hub. */
  onHubsChange: (hubs: ScrobbleHubId[]) => void;
}

/** Hub supportati dal pannello (Maloja è scope Fase 2). */
const SUPPORTED_HUBS: readonly ScrobbleHubId[] = ['lastfm', 'listenbrainz'];

type PanelStatus = 'idle' | 'loading' | 'sending' | 'error';

export function ScrobblePanel({ hubs, onHubsChange }: ScrobblePanelProps) {
  const t = useT();
  const [config, setConfig] = useState<LastfmConfig | null>(null);
  const [counts, setCounts] = useState<Record<ScrobbleOutboxStatus, number> | null>(null);
  const [status, setStatus] = useState<PanelStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const db = await openDb();
      const [queueCounts] = await Promise.all([countScrobbleQueue(db)]);
      setCounts(queueCounts);
    } catch {
      setCounts(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await openDb();
        const [stored] = await Promise.all([loadLastfmConfig(db)]);
        if (!cancelled) {
          setConfig(stored);
          setStatus('idle');
        }
      } catch {
        if (!cancelled) {
          setStatus('idle');
        }
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const toggleHub = useCallback(
    (hub: ScrobbleHubId, enabled: boolean) => {
      const next = enabled ? [...hubs, hub] : hubs.filter((h) => h !== hub);
      onHubsChange(next);
    },
    [hubs, onHubsChange],
  );

  const handleProxyMode = useCallback(
    async (mode: LastfmProxyMode) => {
      if (!config) {
        return;
      }
      const next = { ...config, proxyMode: mode };
      setConfig(next);
      try {
        const db = await openDb();
        await saveLastfmConfig(db, next);
      } catch {
        setStatus('error');
      }
    },
    [config],
  );

  const handleSend = useCallback(async () => {
    setStatus('sending');
    try {
      const db = await openDb();
      for (const hub of SUPPORTED_HUBS) {
        if (!hubs.includes(hub)) {
          continue;
        }
        await enqueueEligibleListens(db, { hub, enabledHubs: hubs, now: Date.now() });
        const sink = getScrobbleSink(hub, {
          lastfm: {
            proxyBaseUrl: config?.proxyBaseUrl ?? '',
            apiKey: config?.apiKey ?? '',
            sharedSecret: config?.sharedSecret ?? '',
            sessionKey: config?.sessionKey ?? '',
            proxyMode: config?.proxyMode ?? 'read-only',
          },
          listenbrainz: {
            token: '',
            userAgent: 'LifeSoundtrack/0.1.0 ( https://example.test/contact )',
          },
        });
        if (!sink.isConfigured()) {
          continue;
        }
        await runScrobbleCycle(db, sink);
      }
      await refresh();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [config, hubs, refresh]);

  return (
    <section className="platform-card" data-testid="scrobble-panel">
      <div className="platform-card__header">
        <span className="platform-card__name">{t('settings.scrobble.title')}</span>
        <span className="platform-card__platform-dot" aria-hidden="true" />
      </div>

      <p className="platform-card__instructions">{t('settings.scrobble.hint')}</p>

      {SUPPORTED_HUBS.map((hub) => (
        <div className="toggle" key={hub}>
          <input
            type="checkbox"
            checked={hubs.includes(hub)}
            onChange={(e) => toggleHub(hub, e.target.checked)}
            data-testid={`scrobble-hub-${hub}`}
          />
          <label>
            <div style={{ fontWeight: 600, color: 'var(--ls-text-primary)' }}>
              {hub === 'lastfm'
                ? t('settings.scrobble.hubLastfm')
                : t('settings.scrobble.hubListenbrainz')}
            </div>
          </label>
        </div>
      ))}

      {hubs.length === 0 && (
        <p className="platform-card__message" data-testid="scrobble-no-hub">
          {t('settings.scrobble.noHubSelected')}
        </p>
      )}

      <label className="platform-card__instructions" htmlFor="scrobble-proxy-mode">
        {t('settings.scrobble.proxyMode')}
      </label>
      <select
        id="scrobble-proxy-mode"
        className="input"
        value={config?.proxyMode ?? 'read-only'}
        onChange={(e) => void handleProxyMode(e.target.value as LastfmProxyMode)}
        data-testid="scrobble-proxy-mode"
      >
        <option value="read-only">{t('settings.scrobble.proxyReadOnly')}</option>
        <option value="read-write">{t('settings.scrobble.proxyReadWrite')}</option>
      </select>
      <p className="platform-card__instructions">{t('settings.scrobble.proxyHint')}</p>

      <div className="platform-card__header" data-testid="scrobble-queue">
        <span className="platform-card__name">{t('settings.scrobble.queue')}</span>
      </div>
      {counts === null ? null : (
        <ul className="bullets" data-testid="scrobble-queue-counts">
          <li>
            {t('settings.scrobble.queuePending')}: {counts.pending}
          </li>
          <li>
            {t('settings.scrobble.queueInFlight')}: {counts.in_flight}
          </li>
          <li>
            {t('settings.scrobble.queueSent')}: {counts.sent}
          </li>
          <li>
            {t('settings.scrobble.queueFailed')}: {counts.failed}
          </li>
        </ul>
      )}
      {counts !== null && counts.pending + counts.in_flight === 0 && (
        <p className="platform-card__message" data-testid="scrobble-queue-empty">
          {t('settings.scrobble.queueEmpty')}
        </p>
      )}

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleSend()}
          disabled={hubs.length === 0 || status === 'sending'}
          data-testid="scrobble-send-now"
        >
          {status === 'sending' ? t('settings.scrobble.sending') : t('settings.scrobble.sendNow')}
        </button>
      </div>

      {status === 'error' && (
        <p className="platform-card__message" aria-live="polite" data-testid="scrobble-error">
          {t('error.generic')}
        </p>
      )}
    </section>
  );
}
