/**
 * MemoryCard — Story 3.1, spec `docs/07-UI-SPEC.md` §2.2.
 *
 * Il ricordo del giorno sulla Home (⑥): artwork, titolo, mood pill e data.
 *
 * L'artwork è **opzionale**: l'app non ha una copertina dei brani (la
 * Story 4.3, artwork, non è ancora implementata) e un'immagine mancante non
 * può essere un placeholder grafico: il ricordo resta leggibile senza.
 * Il ricordo entra con un **fade-in** di 200 ms (`07§4`).
 */

import type { MoodId } from '@core/schema';

/** Un'azione della card (`docs/07-UI-SPEC.md` §2.2). */
export interface MemoryCardAction {
  /** L'icona dell'azione (emoji o glifo). */
  readonly icon: string;
  /** L'etichetta, già resa (è anche l'`aria-label` del bottone). */
  readonly label: string;
  /** Cosa fa l'azione. */
  readonly onClick: () => void;
}

export interface MemoryCardProps {
  /** Titolo del ricordo (testo già reso). */
  title: string;
  /** Sottotitolo (testo già reso). */
  subtitle?: string | undefined;
  /** Mood dominante del ricordo. */
  mood?: MoodId | null | undefined;
  /** Etichetta del mood, già resa. */
  moodLabel?: string | null | undefined;
  /** Data formattata (già resa nella lingua della UI). */
  date?: string | undefined;
  /** URL dell'artwork: se assente, nessuna immagine viene renderizzata. */
  artworkUrl?: string | null | undefined;
  /** Callback al click (deep link al ricordo). */
  onClick?: (() => void) | undefined;
  /**
   * Le azioni della card (nascondi / salva / condividi) — `07§2.2`.
   *
   * Sono **opzionali**: la card della Home (⑥) non ha azioni, quella del
   * feed dei ricordi (⑪) sì.
   */
  actions?: readonly MemoryCardAction[] | undefined;
}

const MOOD_COLORS: Record<string, string> = {
  sad: 'var(--ls-mood-sad)',
  angry: 'var(--ls-mood-angry)',
  neutral: 'var(--ls-mood-neutral)',
  calm: 'var(--ls-mood-calm)',
  happy: 'var(--ls-mood-happy)',
  excited: 'var(--ls-mood-excited)',
};

export function MemoryCard({
  title,
  subtitle,
  mood,
  moodLabel,
  date,
  artworkUrl,
  onClick,
  actions,
}: MemoryCardProps) {
  const moodColor = mood ? (MOOD_COLORS[mood] ?? 'var(--ls-mood-neutral)') : null;

  return (
    <article
      className="memory-card"
      data-testid="memory-card"
      aria-label={title}
      onClick={onClick}
      style={{ animationDelay: '200ms' }}
    >
      {artworkUrl ? (
        <img className="memory-card__artwork" src={artworkUrl} alt={title} loading="lazy" />
      ) : (
        <span className="memory-card__artwork memory-card__artwork--empty" aria-hidden="true" />
      )}
      <div className="memory-card__body">
        <h3 className="memory-card__title">{title}</h3>
        {subtitle && <p className="memory-card__subtitle">{subtitle}</p>}
        <div className="memory-card__meta">
          {moodLabel && (
            <span
              className="mood-pill"
              data-testid="memory-card-mood"
              style={{ backgroundColor: moodColor ?? 'var(--ls-mood-neutral)' }}
            >
              {moodLabel}
            </span>
          )}
          {date && (
            <span className="small" data-testid="memory-card-date">
              {date}
            </span>
          )}
        </div>
        {actions && actions.length > 0 && (
          <div className="memory-card__actions" data-testid="memory-card-actions">
            {actions.map((action, index) => (
              <button
                key={`${action.icon}-${index}`}
                type="button"
                className="memory-card__action"
                aria-label={action.label}
                data-testid={`memory-card-action-${index}`}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick();
                }}
              >
                <span aria-hidden="true">{action.icon}</span>
                <span className="memory-card__action-label">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
