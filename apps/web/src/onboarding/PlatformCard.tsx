/**
 * Card piattaforma con i 5 stati canonici (06-UX-FLOWS-STATES.md §2.3,
 * 07-UI-SPEC §2.5):
 * `empty` / `validating` / `parsing` / `done` / `error`.
 *
 * A11y: radice `role="button"` con `aria-describedby` che punta alle
 * istruzioni; il messaggio di stato usa `aria-live="polite"` così le
 * transizioni vengono annunciate al lettore schermo.
 */
import { useCallback, type ReactElement } from 'react';
import type { PlatformId } from '@core/schema';
import type { PlatformCardStatus } from './types';
import { DropZone } from './DropZone';

export interface PlatformCardProps {
  platform: PlatformId;
  status: PlatformCardStatus;
  count?: number; // eventi trovati/inseriti (stato done/parsing)
  fileName?: string;
  error?: string | null;
  onDrop: (files: FileList) => void;
  onRetry?: () => void;
  disabled?: boolean;
}

const platformNames: Record<string, string> = {
  spotify: 'Spotify',
  youtube_music: 'YouTube Music',
  apple_music: 'Apple Music',
  deezer: 'Deezer',
  tidal: 'Tidal',
  soundcloud: 'SoundCloud',
  lastfm: 'Last.fm',
  listenbrainz: 'ListenBrainz',
  plex: 'Plex',
  navidrome: 'Navidrome',
  manual: 'Manuale',
};

export function PlatformCard({
  platform,
  status,
  count,
  fileName,
  error,
  onDrop,
  onRetry,
  disabled = false,
}: PlatformCardProps) {
  const name = platformNames[platform] ?? platform;
  const instructionsId = `platformcard-${platform}-instructions`;
  const statusId = `platformcard-${platform}-status`;
  const isTerminal = status === 'done' || status === 'error';

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  let statusContent: ReactElement | null = null;

  if (status === 'empty') {
    statusContent = (
      <p className="platform-card__status" id={statusId} aria-live="polite">
        {count ? count + ' eventi' : 'Nessun file'}
      </p>
    );
  } else if (status === 'validating') {
    statusContent = (
      <>
        <div className="platform-card__spinner" aria-hidden="true" />
        <p className="platform-card__status" id={statusId} aria-live="polite">
          Validazione...
        </p>
      </>
    );
  } else if (status === 'parsing') {
    statusContent = (
      <>
        <div className="platform-card__progress">
          <div className="platform-card__progress-bar" style={{ width: '50%' }} />
        </div>
        <p className="platform-card__counter" id={statusId} aria-live="polite">
          {count ?? 0} eventi analizzati
        </p>
      </>
    );
  } else if (status === 'done') {
    statusContent = (
      <>
        <span className="platform-card__done-badge" aria-hidden="true">
          Completo
        </span>
        <p className="platform-card__status" id={statusId} aria-live="polite">
          {count ? count + ' eventi trovati' : 'Import completato'}
        </p>
      </>
    );
  } else if (status === 'error') {
    statusContent = (
      <p className="platform-card__message" id={statusId} aria-live="polite">
        {error ?? 'Errore durante l\'import'}
      </p>
    );
  }

  const ariaLabel = `${name} — stato import: ${status}`;

  return (
    <section
      className={`platform-card platform-card--${status}`}
      role="button"
      aria-label={ariaLabel}
      aria-describedby={`${instructionsId} ${statusId}`}
      data-testid={`platformcard-${platform}`}
      data-status={status}
    >
      <div className="platform-card__header">
        <span className="platform-card__name">{name}</span>
        <span className="platform-card__platform-dot" aria-hidden="true" />
      </div>

      {fileName && (
        <p className="platform-card__file" title={fileName}>
          {fileName}
        </p>
      )}

      {status === 'empty' ? (
        <DropZone
          label="Trascina qui il file"
          browseLabel="Oppure sfoglia"
          hint=""
          onDrop={onDrop}
          disabled={disabled}
        />
      ) : (
        <div className="platform-card__status" id={statusId} aria-live="polite" />
      )}

      {statusContent}

      {!isTerminal && status !== 'empty' && fileName && (
        <p id={instructionsId} className="platform-card__instructions">
          File caricato. Clicca per importare.
        </p>
      )}

      {status === 'error' && onRetry && (
        <div className="platform-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleRetry}
            data-testid="retry-btn"
          >
            Riprova
          </button>
        </div>
      )}
    </section>
  );
}
