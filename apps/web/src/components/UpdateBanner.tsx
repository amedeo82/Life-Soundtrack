import { useEffect, useRef, type CSSProperties } from 'react';
import type { UpdateKind } from '../hooks/useAppUpdate';
import { formatSemver } from '../hooks/useAppUpdate';

export interface UpdateBannerProps {
  /** Tipo di bump (determina se il banner è soft o bloccante). */
  readonly updateKind: UpdateKind;
  /** Versione nuova in attesa (stringa semver leggibile). */
  readonly nextVersionLabel: string;
  /** Versione corrente dell'app (stringa semver leggibile). */
  readonly currentVersionLabel: string;
  /** Click su "Aggiorna ora": aggiorna il SW e ricarica la pagina. */
  readonly onUpdate: () => void;
  /** Click su "Più tardi": nasconde il banner fino al prossimo prompt. */
  readonly onDismiss: () => void;
  /** Quando true e updateKind è 'major', mostra un modal bloccante (richiede migrazione DB). Default false. */
  readonly requiresDbMigration?: boolean;
  /** Test id per test E2E / smoke test. Default `'update-banner'`. */
  readonly testId?: string;
}

const BANNER_STYLE: CSSProperties = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: 'min(560px, calc(100vw - 2rem))',
  padding: '1rem 1.25rem',
  borderRadius: '0.75rem',
  background: 'var(--ls-banner-bg, rgba(19, 24, 41, 0.96))',
  color: 'var(--ls-banner-fg, #FFFFFF)',
  boxShadow: '0 0 24px rgba(139, 92, 246, 0.35)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  zIndex: 1000,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
};

const MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  lineHeight: 1.4,
  opacity: 0.85,
};

const ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

const BUTTON_STYLE: CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  background: 'transparent',
  color: 'inherit',
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  minHeight: '2.5rem',
  minWidth: '5.5rem',
};

const PRIMARY_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  border: 'none',
  background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  color: '#0A0E1A',
  fontWeight: 600,
};

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(10, 14, 26, 0.85)',
  backdropFilter: 'blur(4px)',
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const MODAL_STYLE: CSSProperties = {
  background: 'var(--ls-banner-bg, rgba(19, 24, 41, 0.98))',
  color: 'var(--ls-banner-fg, #FFFFFF)',
  padding: '2rem',
  borderRadius: '1rem',
  maxWidth: 'min(520px, calc(100vw - 2rem))',
  boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  zIndex: 2001,
};

/**
 * Banner UX per notificare l'utente di un update disponibile. Specifica
 * `05-ARCHITECTURE.md §11.3`:
 * - **patch**: NON mostrato (gestione silenziosa)
 * - **minor**: banner soft ("Più tardi" è consentito)
 * - **major**: banner con CTA **Aggiorna ora** obbligatoria ("Più tardi"
 *   disabilitato)
 *
 * Accessibilità: `role="status"` per screen reader; pulsanti raggiungibili via
 * tastiera; `aria-live="polite"` per annunciare la novità senza essere
 * intrusivi.
 *
 * Nota di stile: usa CSS variabili con fallback per integrarsi al design
 * system `15-DESIGN-SYSTEM.md` (qui solo markup; il tema completo arriva
 * con Story 3.1).
 */
export function UpdateBanner({
  updateKind,
  nextVersionLabel,
  currentVersionLabel,
  onUpdate,
  onDismiss,
  requiresDbMigration = false,
  testId = 'update-banner',
}: UpdateBannerProps) {
  const isMajor = updateKind === 'major';
  const showModal = isMajor && requiresDbMigration === true;
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModal) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // patch / silent — non mostriamo nulla (la hook già non notifica)
  if (updateKind === 'patch') return null;

  const title = isMajor ? 'Aggiornamento importante disponibile' : 'Nuova versione disponibile';
  const message = isMajor
    ? `Life-Soundtrack ${currentVersionLabel} → ${nextVersionLabel} include modifiche importanti. È richiesto un riavvio.`
    : `Life-Soundtrack ${currentVersionLabel} → ${nextVersionLabel} è pronto. Aggiorna ora per le ultime funzionalità.`;

  // Spec 05-ARCHITECTURE.md §11.3: major + migrazione DB → modal bloccante; altrimenti banner come minor.
  if (showModal) {
    return (
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-live="polite"
        data-testid={testId}
        data-update-kind={updateKind}
        style={OVERLAY_STYLE}
      >
        <div style={MODAL_STYLE}>
          <h2 style={TITLE_STYLE}>{title}</h2>
          <p style={MESSAGE_STYLE}>{message}</p>
          <div style={ACTIONS_STYLE}>
            <button
              type="button"
              onClick={onUpdate}
              style={PRIMARY_STYLE}
              data-testid={`${testId}-update`}
            >
              Aggiorna e riavvia
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-update-kind={updateKind}
      style={BANNER_STYLE}
    >
      <h2 style={TITLE_STYLE}>{title}</h2>
      <p style={MESSAGE_STYLE}>{message}</p>
      <div style={ACTIONS_STYLE}>
        {!isMajor && (
          <button
            type="button"
            onClick={onDismiss}
            style={BUTTON_STYLE}
            data-testid={`${testId}-dismiss`}
          >
            Più tardi
          </button>
        )}
        <button
          type="button"
          onClick={onUpdate}
          style={PRIMARY_STYLE}
          data-testid={`${testId}-update`}
        >
          {isMajor ? 'Aggiorna e riavvia' : 'Aggiorna ora'}
        </button>
      </div>
      <span style={{ position: 'absolute', left: -9999 }}>
        Aggiornamento {formatSemver([0, 0, 0])} disponibile
      </span>
    </div>
  );
}
