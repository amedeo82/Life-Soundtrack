/**
 * ShareSheet (⑫) — Story 3.2, spec `docs/07-UI-SPEC.md` §2.10 e
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §4.
 *
 * Il foglio di condivisione è un **dialog accessibile**: `role="dialog"`,
 * `aria-modal="true"`, focus trap, chiusura con `Esc` o con il backdrop.
 *
 * Gli stati sono tre: `generating` (la card si sta disegnando), `ready` (la
 * preview c'è e le destinazioni sono attive) ed `error` (la generazione è
 * fallita: si può ritentare). Il componente **non conosce l'i18n**: tutte le
 * etichette arrivano già rese dal chiamante.
 */

import { useEffect, useRef, type ReactElement } from 'react';

/** Una destinazione di condivisione. */
export interface SharePlatform {
  /** Id tecnico della destinazione. */
  readonly id: string;
  /** Icona (emoji o glifo). */
  readonly icon: string;
  /** Etichetta, già resa. */
  readonly label: string;
  /** L'azione. */
  readonly onClick: () => void;
}

export interface ShareSheetProps {
  /** Lo stato del foglio. */
  readonly state: 'generating' | 'ready' | 'error';
  /** L'anteprima della card (URL locale, `Blob` URL). */
  readonly imageUrl?: string | undefined;
  /** Le destinazioni disponibili. */
  readonly platforms: readonly SharePlatform[];
  /** Il titolo del foglio, già reso. */
  readonly title: string;
  /** L'etichetta dello stato `generating`, già resa. */
  readonly generatingLabel: string;
  /** L'etichetta dello stato `error`, già resa. */
  readonly errorLabel: string;
  /** L'etichetta del ritentativo, già resa. */
  readonly retryLabel: string;
  /** L'etichetta di chiusura, già resa. */
  readonly closeLabel: string;
  /** Chiude il foglio. */
  readonly onClose: () => void;
  /** Ritenta la generazione (stato `error`). */
  readonly onRetry?: (() => void) | undefined;
}

export function ShareSheet({
  state,
  imageUrl,
  platforms,
  title,
  generatingLabel,
  errorLabel,
  retryLabel,
  closeLabel,
  onClose,
  onRetry,
}: ShareSheetProps): ReactElement {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelector<HTMLElement>('button:not([disabled])');
    focusable?.focus();
  }, [state]);

  return (
    <div className="share-sheet__backdrop" data-testid="share-sheet-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        data-testid="share-sheet"
        ref={dialogRef}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 className="share-sheet__title" id="share-sheet-title">
          {title}
        </h2>

        {state === 'generating' && (
          <p className="share-sheet__status" role="status" data-testid="share-sheet-generating">
            {generatingLabel}
          </p>
        )}

        {state === 'error' && (
          <div className="share-sheet__error" role="alert" data-testid="share-sheet-error">
            <p>{errorLabel}</p>
            {onRetry && (
              <button
                type="button"
                className="share-sheet__retry"
                data-testid="share-sheet-retry"
                onClick={onRetry}
              >
                {retryLabel}
              </button>
            )}
          </div>
        )}

        {state === 'ready' && (
          <>
            {imageUrl && (
              <img
                className="share-sheet__preview"
                src={imageUrl}
                alt=""
                data-testid="share-sheet-preview"
              />
            )}
            <ul className="share-sheet__platforms">
              {platforms.map((platform) => (
                <li key={platform.id}>
                  <button
                    type="button"
                    className="share-sheet__platform"
                    data-testid={`share-platform-${platform.id}`}
                    onClick={platform.onClick}
                  >
                    <span aria-hidden="true">{platform.icon}</span>
                    <span>{platform.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          className="share-sheet__close"
          data-testid="share-sheet-close"
          onClick={onClose}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
