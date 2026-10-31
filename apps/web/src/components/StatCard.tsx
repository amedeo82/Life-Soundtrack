/**
 * StatCard — Story 3.1, spec `docs/07-UI-SPEC.md` §2.1.
 *
 * Numero grande con contesto: è il componente che apre la Home (⑥). Il
 * valore si conta da solo all'hover (`useCountUp`), il valore esposto agli
 * screen reader è **sempre** quello finale — l'animazione non deve rendere
 * il dato inaccessibile.
 *
 * Contratto a11y (vincolante): `role="status"` e `aria-label` che descrive
 * valore **e** unità.
 */

import { useState } from 'react';
import { useCountUp } from '../hooks/useCountUp';

export interface StatCardProps {
  /** Valore numerico mostrato (intero). */
  value: number;
  /** Etichetta del dato. */
  label: string;
  /** Unità o descrizione del valore (entra nell'`aria-label`). */
  unit?: string | undefined;
  /** Emoji o glifo come icona (nessuna libreria di icone nel toolchain). */
  icon?: string | undefined;
  /** Su un click. */
  onClick?: (() => void) | undefined;
}

export function StatCard({ value, label, unit, icon, onClick }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  const animated = useCountUp(0, value, hovered);

  const ariaLabel = unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`;

  return (
    <div
      className="stat-card"
      role="status"
      aria-label={ariaLabel}
      data-testid="stat-card"
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {icon && (
        <span className="stat-card__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="stat-card__value" data-testid="stat-card-value">
        {Math.round(animated)}
      </span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}
