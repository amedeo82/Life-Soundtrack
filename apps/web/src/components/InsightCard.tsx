/**
 * InsightCard — Story 3.3, spec `docs/07-UI-SPEC.md` §2.9.
 *
 * La card che porta **l'insight in prosa**: il criterio di accettazione della
 * Story 3.3 non è «un grafico in più», è la **frase** che spiega un periodo
 * (`docs/22-COMPETITIVE-POSITIONING.md` §8).
 *
 * Il testo (`description`) arriva **già reso** dal core (`EventPayload.description`,
 * `MemoryPayload.text` — D-A.4): la UI non re-renderizza i template.
 *
 * Il componente non conosce l'i18n: icona, titolo, descrizione e le etichette
 * delle azioni arrivano già rese dalla schermata.
 */

import { useId } from 'react';

export interface InsightCardAction {
  /** L'icona dell'azione. */
  readonly icon: string;
  /** L'etichetta dell'azione (è anche l'`aria-label` del bottone). */
  readonly label: string;
  /** Cosa fa l'azione. */
  readonly onClick: () => void;
}

export interface InsightCardProps {
  /** L'icona dell'insight. */
  readonly icon: string;
  /** Il titolo dell'insight, già reso. */
  readonly title: string;
  /** La frase che spiega il periodo, già resa. */
  readonly description: string;
  /** La rilevanza (0..1), opzionale. */
  readonly confidence?: number | undefined;
  /** Lo stato dell'insight (`pending` / `confirmed` / `corrected` / `dismissed`). */
  readonly status?: 'pending' | 'confirmed' | 'corrected' | 'dismissed' | undefined;
  /** Le azioni dell'utente (confermare / correggere / ignorare). */
  readonly actions?: readonly InsightCardAction[] | undefined;
  /** L'`aria-label` della confidenza, già reso. */
  readonly confidenceLabel?: string | undefined;
}

export function InsightCard({
  icon,
  title,
  description,
  confidence,
  status = 'pending',
  actions,
  confidenceLabel,
}: InsightCardProps) {
  const titleId = useId();

  return (
    <article
      className={`insight-card insight-card--${status}`}
      role="article"
      aria-labelledby={titleId}
      data-testid="insight-card"
      data-status={status}
    >
      <div className="insight-card__header">
        <span className="insight-card__icon" aria-hidden="true">
          {icon}
        </span>
        <h3 className="insight-card__title" id={titleId}>
          {title}
        </h3>
      </div>
      <p className="insight-card__description" data-testid="insight-card-description">
        {description}
      </p>
      {confidence !== undefined && (
        <p className="insight-card__confidence" data-testid="insight-card-confidence">
          {confidenceLabel ?? `${Math.round(confidence * 100)}%`}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="insight-card__actions" data-testid="insight-card-actions">
          {actions.map((action, index) => (
            <button
              key={`${action.icon}-${index}`}
              type="button"
              className="insight-card__action"
              aria-label={action.label}
              data-testid={`insight-card-action-${index}`}
              onClick={() => {
                action.onClick();
              }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span className="insight-card__action-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
