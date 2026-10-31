/**
 * Dettaglio del periodo di contesto — Story 3.4, spec
 * `docs/19-GEO-CONTEXT.md` v1.0 🟢 APPROVED §8.2.
 *
 * La schermata che il nastro apre al click su un segmento: il periodo, gli
 * eventi che lo coprono e le **azioni utente** (`confirmed` / `corrected` /
 * `dismissed`), che aggiornano lo `status` del periodo.
 *
 * L'azione dell'utente è il punto in cui il diario diventa personale
 * (`19§4.3`): l'algoritmo propone, l'utente batte le spalle. Il verdetto
 * viaggia per callback (`onVerdict`) con lo stesso modello di
 * `Insight.status`; la persistenza è del chiamante (core espone
 * `setContextPeriodVerdict`).
 *
 * Come il nastro, **nessuna mappa e nessuna richiesta di rete**: la
 * schermata mostra dati e raccoglie un verdetto.
 */

import { useState } from 'react';
import type { ContextVerdict } from '@core/context';
import { useLanguage, useT } from '../i18n';
import type { ContextRibbonPeriod } from './contextRibbonModel';
import { describePeriodCity, describePeriodLocation } from './contextRibbonModel';

/** Evento ascolto che il periodo copre (dati, non copy). */
export interface ContextPeriodEvent {
  id: string;
  /** Titolo del brano (dato). */
  title: string;
  /** Artista (dato, opzionale). */
  artist?: string;
  /** Unix ms UTC. */
  playedAt: number;
}

export interface ContextPeriodDetailProps {
  period: ContextRibbonPeriod;
  /** Eventi coperti dal periodo. */
  events?: readonly ContextPeriodEvent[];
  /** Il verdetto dell'utente: aggiorna lo `status` del periodo. */
  onVerdict?: (
    periodId: string,
    verdict: { status: ContextVerdict; userLabel?: string | null },
  ) => void;
  /** Chiusura della schermata. */
  onClose?: () => void;
}

/** Formattazione della finestra temporale del periodo, nella lingua della UI. */
function formatPeriodRange(start: number, end: number, locale: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  const from = new Date(start).toLocaleString(locale, options);
  const to = new Date(end).toLocaleString(locale, options);
  return `${from} → ${to}`;
}

/** Schermata di dettaglio del periodo di contesto. */
export function ContextPeriodDetail({
  period,
  events = [],
  onVerdict,
  onClose,
}: ContextPeriodDetailProps) {
  const t = useT();
  const language = useLanguage();
  const [label, setLabel] = useState(period.userLabel ?? '');
  const location = describePeriodLocation(period, t);
  const city = describePeriodCity(period, t);

  const emit = (status: ContextVerdict, userLabel?: string | null) => {
    // Un'etichetta vuota non è un'etichetta: `null` dice "nessuna".
    const trimmed = (userLabel ?? '').trim();
    onVerdict?.(period.id, { status, userLabel: trimmed === '' ? null : trimmed });
  };

  return (
    <section className="context-detail" aria-label={t('timeline.context.detail.title')}>
      <header>
        <h3>{t('timeline.context.detail.title')}</h3>
        <p className="mono small" data-testid="context-detail-range">
          {formatPeriodRange(period.startTime, period.endTime, language)}
        </p>
      </header>

      <dl className="context-detail__facts">
        <dt>{t('timeline.context.filter.kind')}</dt>
        <dd data-testid="context-detail-kind">{t(`timeline.context.kind.${period.kind}`)}</dd>

        <dt>{t('timeline.context.detail.country')}</dt>
        <dd data-testid="context-detail-country">
          {period.country ?? t('timeline.context.unknown')}
        </dd>

        <dt>{t('timeline.context.detail.city')}</dt>
        <dd data-testid="context-detail-city">{city ?? t('timeline.context.unknown')}</dd>

        <dt>{t('timeline.context.filter.device')}</dt>
        <dd data-testid="context-detail-devices">
          {period.deviceTypes.length > 0
            ? period.deviceTypes.map((d) => t(`timeline.context.device.${d}`)).join(', ')
            : t('timeline.context.unknown')}
        </dd>

        <dt>{t('timeline.context.detail.eventsTitle')}</dt>
        <dd data-testid="context-detail-event-count">
          {t('timeline.context.detail.events', { count: period.eventCount })}
        </dd>

        <dt>{t('timeline.context.detail.status')}</dt>
        <dd data-testid="context-detail-status">{t(`timeline.context.status.${period.status}`)}</dd>
      </dl>

      {location && (
        <p className="small" data-testid="context-detail-location">
          {location}
        </p>
      )}

      <section aria-label={t('timeline.context.detail.eventsTitle')}>
        {events.length === 0 ? (
          <p className="small" data-testid="context-detail-no-events">
            {t('timeline.context.detail.noEvents')}
          </p>
        ) : (
          <ul data-testid="context-detail-events">
            {events.map((event) => (
              <li key={event.id}>
                <span>{event.title}</span>
                {event.artist && <span className="small"> · {event.artist}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('timeline.context.action.label')}>
        <label>
          <span className="small">{t('timeline.context.action.label')}</span>
          <input
            type="text"
            data-testid="context-detail-label-input"
            value={label}
            placeholder={t('timeline.context.action.labelPlaceholder')}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn"
            data-testid="context-detail-confirm"
            onClick={() => emit('confirmed', label)}
          >
            {t('timeline.context.action.confirm')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="context-detail-correct"
            onClick={() => emit('corrected', label)}
          >
            {t('timeline.context.action.correct')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="context-detail-dismiss"
            onClick={() => emit('dismissed', label)}
          >
            {t('timeline.context.action.dismiss')}
          </button>
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="context-detail-close"
              onClick={onClose}
            >
              {t('common.close')}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
