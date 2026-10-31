/**
 * EraBand — Story 3.1, spec `docs/07-UI-SPEC.md` §2.3.
 *
 * Il segmento colorato che rappresenta un'era musicale nella Timeline.
 *
 * Contratto a11y (vincolante): `role="button"`, `aria-expanded` e
 * `aria-label` con **durata** e mood. L'hover sincronizza l'evidenziazione
 * con i grafici adiacenti (`06§2.7`): il highlight è uno **stato condiviso**
 * della Timeline, non un effetto locale del band.
 *
 * Il colore dipende dal mood dell'era (`design/tokens.json` → `color.mood`):
 * un'era senza mood non inventa un colore — resta neutra.
 */

import type { EraBandModel } from '../screens/homeTimelineModel';

export interface EraBandProps {
  era: EraBandModel;
  /** L'era è quella attualmente espansa. */
  isActive: boolean;
  /** Larghezza percentuale della banda rispetto all'intervallo visibile. */
  widthPercent: number;
  /** Offset percentuale della banda rispetto all'intervallo visibile. */
  offsetPercent: number;
  /** Etichetta del mood, già resa. */
  moodLabel: string | null;
  /** Durata resa (giorni), per l'`aria-label`. */
  durationLabel: string;
  /** Callback all'hover (sincronizzazione con i grafici). */
  onHover?: ((eraId: string | null) => void) | undefined;
  /** Callback al click (apre il dettaglio dell'era, schermata ⑧). */
  onSelect?: ((era: EraBandModel) => void) | undefined;
}

const MOOD_COLORS: Record<string, string> = {
  sad: 'var(--ls-mood-sad)',
  angry: 'var(--ls-mood-angry)',
  neutral: 'var(--ls-mood-neutral)',
  calm: 'var(--ls-mood-calm)',
  happy: 'var(--ls-mood-happy)',
  excited: 'var(--ls-mood-excited)',
};

export function EraBand({
  era,
  isActive,
  widthPercent,
  offsetPercent,
  moodLabel,
  durationLabel,
  onHover,
  onSelect,
}: EraBandProps) {
  const color = era.mood
    ? (MOOD_COLORS[era.mood] ?? 'var(--ls-text-muted)')
    : 'var(--ls-text-muted)';
  const ariaLabel = moodLabel
    ? `${era.label}, ${durationLabel}, ${moodLabel}`
    : `${era.label}, ${durationLabel}`;

  return (
    <button
      type="button"
      role="button"
      aria-expanded={isActive}
      aria-label={ariaLabel}
      className="era-band"
      data-testid={`era-band-${era.id}`}
      data-mood={era.mood ?? 'unknown'}
      style={{
        position: 'absolute',
        left: `${offsetPercent}%`,
        width: `${widthPercent}%`,
        borderColor: color,
        backgroundColor: color,
      }}
      onMouseEnter={() => onHover?.(era.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(era.id)}
      onBlur={() => onHover?.(null)}
      onClick={() => onSelect?.(era)}
    >
      <span className="era-band__label">{era.label}</span>
    </button>
  );
}
