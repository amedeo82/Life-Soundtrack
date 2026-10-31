/**
 * Nastro contesto — Story 3.4, spec `docs/19-GEO-CONTEXT.md` v1.0 🟢 APPROVED §8.2.
 *
 * Una striscia orizzontale sotto le `EraBand` della Timeline: **un segmento per
 * `ContextPeriod`**, colorato per `kind`, con l'etichetta del paese, la città
 * introdotta da un indicatore di incertezza e i pips dei dispositivi presenti.
 *
 * Tre regole della spec sono **vincolanti** e l'implementazione le rende
 * strutturalmente, non per convenzione:
 *
 * 1. **La città è sempre introdotta da un indicatore di incertezza, il paese
 *    mai** (§8.3): la città stimata dal database (`citySource = 'dbip-lite'`)
 *    è resa come «circa *X*»; il paese è un fatto e si mostra come tale. Una
 *    città corretta a mano (`citySource = 'manual'`) smette di essere una
 *    stima e si mostra piana. La regola è applicata in un solo punto —
 *    `describePeriodCity` in `contextRibbonModel.ts`.
 * 2. **Nessuna mappa** (§8.2): nessuna dipendenza cartografica, nessun tile,
 *    nessun placeholder. Il componente non ha bisogno di `img`, `svg` o di
 *    alcuna risorsa esterna: la scala disponibile (paese, talvolta città) non
 *    giustifica una mappa, e un tile implicherebbe uscita dalla rete.
 * 3. **Nessuna richiesta di rete**: il nastro riceve i periodi dal chiamante e
 *    non sa nulla di `fetch`, `XMLHttpRequest` o dei servizi di enrichment.
 *
 * Il nastro è un componente **presentazionale**: i dati arrivano per props e
 * le azioni escono per callback. Questo lo rende testabile senza database e
 * gli lascia la libertà di essere montato sulla Timeline (Story 3.1) o da solo.
 *
 * Il periodo senza contesto determinato resta `unknown` e **non viene
 * aggregato** (§5.3): i segmenti sono uno per periodo, mai uno per gruppo.
 */

import { useMemo, useState } from 'react';
import type { ContextKind, DeviceType } from '@core/schema';
import { CONTEXT_KINDS } from '@core/schema';
import { useT } from '../i18n';
import {
  CONTEXT_KIND_COLORS,
  describePeriodLocation,
  isPeriodVisible,
  type ContextRibbonPeriod,
  type ContextRibbonRange,
} from './contextRibbonModel';

export interface ContextRibbonProps {
  /** Periodi da mostrare, in ordine cronologico. */
  periods: readonly ContextRibbonPeriod[];
  /** Range visibile (zoom della Timeline): default, tutto. */
  visibleRange?: ContextRibbonRange;
  /** Chiamata quando l'utente sceglie un periodo (apre il dettaglio). */
  onSelect?: (period: ContextRibbonPeriod) => void;
}

/**
 * Nastro contesto: striscia orizzontale di segmenti, con i filtri per
 * `kind`, paese e dispositivo (§8.2).
 */
export function ContextRibbon({ periods, visibleRange, onSelect }: ContextRibbonProps) {
  const t = useT();
  const [kindFilter, setKindFilter] = useState<ContextKind | 'all'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | 'all'>('all');

  const countries = useMemo(
    () =>
      Array.from(
        new Set(periods.map((p) => p.country).filter((c): c is string => Boolean(c))),
      ).sort(),
    [periods],
  );

  const visible = useMemo(
    () =>
      periods.filter(
        (p) =>
          isPeriodVisible(p, visibleRange) &&
          (kindFilter === 'all' || p.kind === kindFilter) &&
          (countryFilter === 'all' || p.country === countryFilter) &&
          (deviceFilter === 'all' || p.deviceTypes.includes(deviceFilter)),
      ),
    [periods, visibleRange, kindFilter, countryFilter, deviceFilter],
  );

  return (
    <section className="context-ribbon" aria-label={t('timeline.context.title')}>
      <div className="context-ribbon__filters">
        <label>
          <span className="small">{t('timeline.context.filter.kind')}</span>
          <select
            data-testid="context-filter-kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as ContextKind | 'all')}
          >
            <option value="all">{t('timeline.context.filter.all')}</option>
            {CONTEXT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`timeline.context.kind.${kind}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="small">{t('timeline.context.filter.country')}</span>
          <select
            data-testid="context-filter-country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="all">{t('timeline.context.filter.all')}</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="small">{t('timeline.context.filter.device')}</span>
          <select
            data-testid="context-filter-device"
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value as DeviceType | 'all')}
          >
            <option value="all">{t('timeline.context.filter.all')}</option>
            {Array.from(new Set(periods.flatMap((p) => p.deviceTypes))).map((device) => (
              <option key={device} value={device}>
                {t(`timeline.context.device.${device}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="small" data-testid="context-ribbon-empty">
          {t('timeline.context.empty')}
        </p>
      ) : (
        <div className="context-ribbon__segments" role="list">
          {visible.map((period) => {
            const location = describePeriodLocation(period, t);
            const title = period.userLabel ?? location ?? t(`timeline.context.kind.${period.kind}`);
            return (
              <button
                key={period.id}
                type="button"
                role="listitem"
                className="context-ribbon__segment"
                data-testid={`context-segment-${period.id}`}
                data-kind={period.kind}
                data-status={period.status}
                style={{ borderColor: CONTEXT_KIND_COLORS[period.kind] }}
                aria-label={`${t(`timeline.context.kind.${period.kind}`)}: ${title}`}
                onClick={() => onSelect?.(period)}
              >
                <span className="context-ribbon__kind">
                  {t(`timeline.context.kind.${period.kind}`)}
                </span>
                {period.userLabel ? (
                  <span className="context-ribbon__label">{period.userLabel}</span>
                ) : (
                  location && <span className="context-ribbon__location">{location}</span>
                )}
                <span className="context-ribbon__pips" aria-hidden="true">
                  {period.deviceTypes.map((device) => (
                    <i
                      key={device}
                      className="context-ribbon__pip"
                      data-device={device}
                      title={t(`timeline.context.device.${device}`)}
                    />
                  ))}
                </span>
                <span className="context-ribbon__pips-label">
                  {period.deviceTypes
                    .map((device) => t(`timeline.context.device.${device}`))
                    .join(', ')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
