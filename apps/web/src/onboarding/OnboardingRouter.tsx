/**
 * Router dello onboarding Story 0.4: macchina a stati schermate
 * ① Benvenuto → ② Privacy → ③ Import → ④ Processing → ⑤ Rivelazione.
 *
 * Orchestra `SpotifyAdapter` + `runImport` (05-ARCHITECTURE §4-5, 05§3.1)
 * senza scrivere nulla nel DB prima del click "Importa tutto": `detect()`
 * valida il formato (nessuna scrittura), `runImport` persiste a chunk solo
 * quando l'utente avvia l'import. Cancellazione cooperativa via AbortController
 * (05§4).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { type PrivacySettings } from '@core/schema';
import { SpotifyAdapter } from '@core/adapters/spotify';
import { YouTubeMusicAdapter } from '@core/adapters/youtube';
import { AppleMusicAdapter } from '@core/adapters/apple';
import { ListenBrainzAdapter } from '@core/adapters/listenbrainz';
import { LastfmAdapter } from '@core/adapters/lastfm';
import type { PlatformAdapter } from '@core/adapters';
import { DEMO_DB_NAME, openDb } from '@core/db';
import type { PlatformId } from '@core/schema';
import { runImport, AdapterError } from '@core/adapters';
import type { ImportPlatformState, PlatformCardStatus } from './types';
import { loadPrivacy, savePrivacy } from './PrivacySettings';
import { PlatformCard } from './PlatformCard';
import { LastfmPanel } from './LastfmPanel';
import { ScrobblePanel } from './ScrobblePanel';
import { useT } from '../i18n';
import { createAnalysisRunner } from '../analysis/analysisRunner';
import { i18n } from '../i18n';
import { createLogger } from '@core/logger';
import { AppShell } from '../screens/AppShell';
import { startDemo, stopDemo } from '../demo/demoMode';
import { buildRevealPreview, type RevealPreview } from './revealPreview';

/**
 * Adapter disponibili per piattaforma (05§4): una entry solo quando
 * l'adapter esiste (Spotify: Story 0.3; YouTube Music: Story 1.1; Apple Music:
 * Story 1.2; ListenBrainz + Last.fm: Story 1.3).
 */
const ADAPTER_FACTORIES: Partial<Record<PlatformId, () => PlatformAdapter>> = {
  spotify: () => new SpotifyAdapter(),
  youtube_music: () => new YouTubeMusicAdapter(),
  apple_music: () => new AppleMusicAdapter(),
  listenbrainz: () => new ListenBrainzAdapter(),
  lastfm: () => new LastfmAdapter(),
};

const ACTIVE_PLATFORMS: PlatformId[] = [
  'spotify',
  'youtube_music',
  'apple_music',
  'listenbrainz',
  'lastfm',
];

const createAdapter = (platform: PlatformId): PlatformAdapter | null =>
  ADAPTER_FACTORIES[platform]?.() ?? null;

const initialState: ImportPlatformState = {
  status: 'empty' as PlatformCardStatus,
  file: null,
  error: null,
  eventsParsed: 0,
  eventsInserted: 0,
  uniqueTracks: 0,
};

export function OnboardingRouter({ onComplete }: { onComplete?: (() => void) | undefined }) {
  const t = useT();
  const [screen, setScreen] = useState<
    | 'welcome'
    | 'privacy'
    | 'import'
    | 'processing'
    | 'reveal'
    | 'demo'
    | 'demo-loading'
    | 'demo-error'
  >('welcome');
  const [privacy, setPrivacy] = useState<PrivacySettings>(loadPrivacy());
  const [importStates, setImportStates] = useState<Record<string, ImportPlatformState>>(
    Object.fromEntries(ACTIVE_PLATFORMS.map((p) => [p, { ...initialState }])),
  );
  /** L'anteprima del reveal: le prime righe e l'anno calcolato. */
  const [reveal, setReveal] = useState<RevealPreview | null>(null);

  /** Aggiorna lo stato di una singola piattaforma preservando gli altri campi. */
  const setPlatformState = (platform: PlatformId, patch: Partial<ImportPlatformState>) => {
    setImportStates((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], ...patch } as ImportPlatformState,
    }));
  };
  const abortControllerRef = useRef<AbortController | null>(null);
  const dbRef = useRef<Awaited<ReturnType<typeof openDb>> | null>(null);
  const analysisRunnerRef = useRef<ReturnType<typeof createAnalysisRunner> | null>(null);

  const ensureDb = useCallback(async () => {
    if (!dbRef.current) {
      dbRef.current = await openDb();
    }
    return dbRef.current;
  }, []);

  /* ─── ② Privacy ─── */
  const handlePrivacyChange = useCallback(
    (key: keyof PrivacySettings, value: boolean | string[]) => {
      setPrivacy((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handlePrivacySave = useCallback(() => {
    savePrivacy(privacy);
    setScreen('import');
  }, [privacy]);

  /* ─── ③ Import — drop + detect ─── */
  const handleDrop = useCallback(
    async (platform: PlatformId, files: FileList) => {
      const file = files[0];
      if (!file) return;
      if (file.size > 500 * 1024 * 1024) {
        setPlatformState(platform, { status: 'error', error: t('error.fileTooLarge') });
        return;
      }

      setPlatformState(platform, {
        status: 'validating',
        file,
        error: null,
        eventsParsed: 0,
        eventsInserted: 0,
      });

      const adapter = createAdapter(platform);
      if (!adapter) {
        setPlatformState(platform, { status: 'error', error: t('error.generic') });
        return;
      }
      try {
        const ok = await adapter.detect(file);
        if (!ok) {
          // Errore guidato export HTML (youtube-music.md §2.2): il contratto
          // detect è booleano, la discriminazione del formato è lato UI.
          let errorKey = `adapter.${platform}.detect.fail`;
          if (platform === 'youtube_music') {
            const head = await file.slice(0, 64).text();
            if (head.trimStart().startsWith('<')) {
              errorKey = 'adapter.youtube_music.error.htmlExport';
            }
          }
          setPlatformState(platform, { status: 'error', error: t(errorKey) });
          return;
        }
        setPlatformState(platform, { status: 'empty', error: null });
      } catch {
        setPlatformState(platform, {
          status: 'error',
          error: t(`adapter.${platform}.detect.fail`),
        });
      }
    },
    [t],
  );

  const anyValid = useMemo(
    () => ACTIVE_PLATFORMS.some((p) => !!importStates[p]?.file),
    [importStates],
  );

  /* ─── ④ Processing — runImport su tutti i file validi ─── */
  const handleImportAll = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pending = ACTIVE_PLATFORMS.filter((p) => !!importStates[p]?.file);
    setScreen('processing');

    let failed = false;
    for (const platform of pending) {
      if (controller.signal.aborted) break;
      const file = importStates[platform]!.file!;
      setPlatformState(platform, { status: 'parsing', eventsParsed: 0, eventsInserted: 0 });

      try {
        const db = await ensureDb();
        const adapter = createAdapter(platform);
        if (!adapter) {
          setPlatformState(platform, { status: 'error', error: t('error.generic') });
          failed = true;
          break;
        }
        const summary = await runImport(db, adapter, file, {
          privacy,
          signal: controller.signal,
          fileName: file.name,
          onProgress: (eventsParsed) => {
            setPlatformState(platform, { status: 'parsing', eventsParsed });
          },
        });

        if (controller.signal.aborted) {
          setPlatformState(platform, { status: 'empty' });
          failed = true;
          break;
        }

        let uniqueTracks = 0;
        try {
          uniqueTracks = await db.tracks.count();
        } catch {
          /* ignore */
        }

        setPlatformState(platform, {
          status: 'done',
          eventsInserted: summary.eventsInserted,
          uniqueTracks,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          failed = true;
          break;
        }
        let message = t('error.generic');
        if (error instanceof AdapterError) {
          message = error.recoverable ? 'Import parzialmente completato' : error.message;
        }
        setPlatformState(platform, { status: 'error', error: message });
        failed = true;
      }
    }

    if (!failed && !controller.signal.aborted) {
      // L'anteprima: le prime righe della timeline **reale** e l'anno
      // calcolato dallo span dei dati (Story 3.5, 26§4).
      try {
        const db = await ensureDb();
        setReveal(await buildRevealPreview(db));
      } catch {
        setReveal(null);
      }
      setScreen('reveal');

      // Trigger analisi post-import (in background, non blocca l'import)
      // 05§6.1: l'import non attende l'analisi
      void (async () => {
        try {
          if (!analysisRunnerRef.current) {
            analysisRunnerRef.current = createAnalysisRunner({
              i18n,
              logger: createLogger('onboarding:analysis'),
            });
          }
          await analysisRunnerRef.current.run('post-import');
        } catch {
          // Errori già loggati dal runner, non propagare
        }
      })();
    }
  }, [importStates, privacy, ensureDb, t]);

  /* ─── Demo — il diario di esempio (Story 3.5) ─── */
  const handleStartDemo = useCallback(async () => {
    setScreen('demo-loading');
    try {
      await startDemo();
      setScreen('demo');
    } catch {
      setScreen('demo-error');
    }
  }, []);

  const handleExitDemo = useCallback(() => {
    // Si torna all'onboarding **prima** di cancellare: la shell smonta i suoi
    // hook, poi il database demo sparisce con un click (06§2.14).
    setScreen('welcome');
    void stopDemo().catch(() => {
      /* la cancellazione non deve bloccare il ritorno all'onboarding */
    });
  }, []);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setScreen('import');
  }, []);

  const handleRetry = useCallback(
    (platform: PlatformId) => {
      const file = importStates[platform]?.file;
      if (!file) return;
      handleDrop(platform, { [0]: file } as unknown as FileList);
    },
    [importStates, handleDrop],
  );

  const totalEvents = useMemo(
    () =>
      Object.values(importStates).reduce(
        (sum, s) => sum + s.eventsInserted + (s.status === 'parsing' ? s.eventsParsed : 0),
        0,
      ),
    [importStates],
  );

  /* ─── Render schermata attiva ─── */
  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onStart={() => setScreen('privacy')}
        onStartDemo={() => {
          void handleStartDemo();
        }}
      />
    );
  }
  if (screen === 'privacy') {
    return (
      <PrivacyScreen privacy={privacy} onChange={handlePrivacyChange} onSave={handlePrivacySave} />
    );
  }
  if (screen === 'import') {
    return (
      <ImportScreen
        states={importStates}
        onDrop={handleDrop}
        onImportAll={handleImportAll}
        onRetry={handleRetry}
        detecting={ACTIVE_PLATFORMS.some((p) => importStates[p]?.status === 'validating')}
        canImport={anyValid}
        privacy={privacy}
      />
    );
  }
  if (screen === 'processing') {
    return <ProcessingScreen total={totalEvents} onCancel={handleCancel} />;
  }
  if (screen === 'demo-loading') {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card" role="status" data-testid="demo-loading">
          <div className="processing-ring" aria-hidden="true" />
          <h2>{t('onboarding.demo.loading.title')}</h2>
          <p>{t('onboarding.demo.loading.subtitle')}</p>
        </div>
      </main>
    );
  }
  if (screen === 'demo-error') {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card" role="alert" data-testid="demo-error">
          <h2>{t('onboarding.demo.error.title')}</h2>
          <p>{t('onboarding.demo.error.subtitle')}</p>
          <div className="onboarding-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('welcome')}
              data-testid="demo-error-back"
            >
              {t('onboarding.demo.error.back')}
            </button>
          </div>
        </div>
      </main>
    );
  }
  if (screen === 'demo') {
    return <AppShell dbName={DEMO_DB_NAME} demo onExitDemo={handleExitDemo} />;
  }
  return (
    <RevealScreen
      events={totalEvents}
      preview={reveal}
      onComplete={() => {
        onComplete?.();
        setScreen('welcome');
      }}
    />
  );
}

export function WelcomeScreen({
  onStart,
  onStartDemo,
}: {
  onStart: () => void;
  onStartDemo?: () => void;
}) {
  const t = useT();
  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <div
          style={{
            fontSize: '2.5rem',
            marginBottom: 'var(--ls-spacing-md)',
            display: 'inline-block',
          }}
        >
          🎵
        </div>
        <h2>{t('onboarding.welcome.title')}</h2>
        <p>{t('onboarding.welcome.subtitle')}</p>
        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStart}
            data-testid="welcome-cta"
          >
            {t('onboarding.welcome.cta')}
          </button>
          {onStartDemo && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onStartDemo}
              data-testid="demo-cta"
            >
              {t('empty.cta.demo')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function PrivacyScreen({
  privacy,
  onChange,
  onSave,
}: {
  privacy: PrivacySettings;
  onChange: (key: keyof PrivacySettings, value: boolean | string[]) => void;
  onSave: () => void;
}) {
  const t = useT();
  const toggles = [
    {
      key: 'retainIp' as const,
      label: t('settings.privacy.retainIp'),
      desc: t('settings.privacy.retainIpDesc'),
    },
    {
      key: 'enrichMetadata' as const,
      label: t('settings.privacy.enrich'),
      desc: t('settings.privacy.enrichDesc'),
    },
    {
      key: 'carDetectionConsent' as const,
      label: t('settings.privacy.carDetection'),
      desc: t('settings.privacy.carDetectionDesc'),
    },
    {
      key: 'syncCloud' as const,
      label: t('settings.privacy.syncCloud'),
      desc: t('settings.privacy.syncCloudDesc'),
    },
  ];
  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <div
          style={{
            fontSize: '2.5rem',
            marginBottom: 'var(--ls-spacing-md)',
            display: 'inline-block',
          }}
        >
          🔒
        </div>
        <h2>{t('onboarding.privacy.title')}</h2>
        <ul className="bullets">
          <li>{t('onboarding.privacy.bullet1')}</li>
          <li>{t('onboarding.privacy.bullet2')}</li>
          <li>{t('onboarding.privacy.bullet3')}</li>
        </ul>
        <div style={{ marginBottom: 'var(--ls-spacing-lg)' }}>
          {toggles.map(({ key, label, desc }) => (
            <div className="toggle" key={key}>
              <input
                type="checkbox"
                checked={!!privacy[key]}
                onChange={(e) => onChange(key, e.target.checked)}
                data-testid={`toggle-${key}`}
              />
              <label>
                <div style={{ fontWeight: 600, color: 'var(--ls-text-primary)' }}>{label}</div>
                <div className="desc">{desc}</div>
              </label>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--ls-text-muted)',
            marginBottom: 'var(--ls-spacing-lg)',
          }}
        >
          {t('onboarding.import.lock')}
        </p>
        <ScrobblePanel
          hubs={privacy.scrobbleHubs}
          onHubsChange={(hubs) => onChange('scrobbleHubs', hubs)}
        />
        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            data-testid="privacy-cta"
          >
            {t('onboarding.privacy.cta')}
          </button>
        </div>
      </div>
    </main>
  );
}

export function ImportScreen({
  states,
  onDrop,
  onImportAll,
  onRetry,
  detecting,
  canImport,
  privacy,
}: {
  states: Record<string, ImportPlatformState>;
  onDrop: (platform: PlatformId, files: FileList) => void;
  onImportAll: () => void;
  onRetry?: (platform: PlatformId) => void;
  detecting: boolean;
  canImport: boolean;
  privacy: PrivacySettings;
}) {
  const t = useT();
  return (
    <main className="onboarding-shell">
      <div className="onboarding-card" style={{ maxWidth: '640px', textAlign: 'left' }}>
        <h2>{t('onboarding.import.title')}</h2>
        <p>{t('onboarding.import.subtitle')}</p>
        <div style={{ marginBottom: 'var(--ls-spacing-lg)' }}>
          {Object.entries(states).map(([platform, state]) => (
            <div key={platform} style={{ marginBottom: 'var(--ls-spacing-lg)' }}>
              <PlatformCard
                platform={platform as PlatformId}
                status={state.status}
                count={state.eventsParsed || state.eventsInserted}
                fileName={state.file?.name ?? ''}
                error={state.error ?? null}
                onDrop={(files) => onDrop(platform as PlatformId, files)}
                onRetry={() => onRetry?.(platform as PlatformId)}
                disabled={detecting || state.status === 'done'}
              />
            </div>
          ))}
          {/* Percorso API Last.fm: proxy, chiave e username sono
              per-utente e locali (D-LF.0/D-LF.1). Senza configurazione il
              bottone resta disabilitato e **zero richieste** partono
              (E.LF.7); il percorso file della card sopra resta
              disponibile. */}
          <div style={{ marginBottom: 'var(--ls-spacing-lg)' }}>
            <LastfmPanel privacy={privacy} />
          </div>
        </div>
        <div className="onboarding-actions">
          {detecting ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled
              data-testid="import-all-detecting"
            >
              {t('common.loading')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canImport || detecting}
              onClick={onImportAll}
              data-testid="import-all"
            >
              {t('onboarding.import.importAll')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function ProcessingScreen({ total, onCancel }: { total: number; onCancel: () => void }) {
  const t = useT();
  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <div className="processing-ring" aria-hidden="true" />
        <h2>{t('onboarding.processing.title')}</h2>
        <div className="processing-counters">
          <div className="row">
            <span className="label">
              {t('onboarding.processing.events_other', { count: total })}
            </span>
            <span className="value" data-testid="counter-events">
              {total}
            </span>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--ls-text-muted)' }}>
          {t('onboarding.import.lock')}
        </p>
        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            data-testid="processing-cancel"
          >
            {t('onboarding.processing.cancel')}
          </button>
        </div>
      </div>
    </main>
  );
}

export function RevealScreen({
  events,
  preview,
  onComplete,
}: {
  events: number;
  preview?: RevealPreview | null | undefined;
  onComplete: () => void;
}) {
  const t = useT();
  // L'anno è **calcolato** dallo span reale, non cablato a 1 (26§4).
  const years = preview?.years ?? 1;
  const rows = preview?.rows ?? [];
  const subtitleKey =
    years === 1 ? 'onboarding.reveal.subtitle_one' : 'onboarding.reveal.subtitle_other';
  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <div
          style={{
            fontSize: '3rem',
            marginBottom: 'var(--ls-spacing-md)',
            display: 'inline-block',
          }}
        >
          ✨
        </div>
        <div className="reveal-number">{events}</div>
        <h2>{t('onboarding.reveal.title')}</h2>
        <p>{t(subtitleKey, { years, events })}</p>
        {rows.length > 0 ? (
          <>
            <h3 className="reveal-preview__title">{t('onboarding.reveal.preview.title')}</h3>
            <ul className="reveal-preview" data-testid="reveal-preview">
              {rows.map((row) => (
                <li
                  key={row.start}
                  className="reveal-preview__row"
                  data-testid="reveal-preview-row"
                >
                  <span className="reveal-preview__label">{row.label}</span>
                  <span className="reveal-preview__value">
                    {t(
                      row.listens === 1
                        ? 'onboarding.reveal.preview.listens_one'
                        : 'onboarding.reveal.preview.listens_other',
                      { count: row.listens },
                    )}
                  </span>
                  {row.mood && (
                    <span className="reveal-preview__mood">{t(`analysis.moods.${row.mood}`)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="reveal-preview__empty" data-testid="reveal-no-preview">
            {t('onboarding.reveal.skip')}
          </p>
        )}
        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onComplete}
            data-testid="reveal-cta"
          >
            {t('onboarding.reveal.cta')}
          </button>
        </div>
      </div>
    </main>
  );
}
