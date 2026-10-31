/**
 * Modello del nastro contesto — Story 3.4, spec `docs/19-GEO-CONTEXT.md` v1.0
 * 🟢 APPROVED §8.2.
 *
 * Il modulo raccoglie la **logica pura** del nastro (view model, regola di
 * località, visibilità, colori): niente React, niente i18n, niente DOM. Il
 * componente (`ContextRibbon.tsx`) lo consuma e resta l'unico file che
 * esporta componenti — la regola `react-refresh/only-export-components` chiede
 * esattamente questa separazione.
 *
 * Due regole della spec sono applicate **qui**, in un solo punto:
 *
 * 1. **La città è sempre introdotta da un indicatore di incertezza, il paese
 *    mai** (§8.3): la città stimata dal database (`citySource = 'dbip-lite'`)
 *    è resa come «circa *X*»; il paese è un fatto e si mostra come tale. Una
 *    città corretta a mano (`citySource = 'manual'`) smette di essere una
 *    stima e si mostra piana.
 * 2. **Il periodo senza contesto determinato non viene aggregato** (§5.3): i
 *    segmenti sono uno per periodo, mai uno per gruppo.
 */

import type { TFunction } from 'i18next';
import type { CitySource, ContextKind, ContextPeriod, DeviceType } from '@core/schema';

/**
 * Periodo come visto dal nastro.
 *
 * `ContextPeriod` (core) non porta la **provenienza** della città: la città
 * stimata vive sull'evento (`ListenEvent.citySource`, `02§4.1`). Il nastro ha
 * bisogno di saperlo, perché «circa *X*» e *X* sono due affermazioni
 * diverse. Il campo è dunque **esplicito** nel view model, e
 * {@link toRibbonPeriod} applica la regola di default: una città presente su
 * un periodo non corretto è una stima.
 */
export interface ContextRibbonPeriod {
  id: string;
  startTime: number;
  endTime: number;
  kind: ContextKind;
  country: string | null;
  city: string | null;
  /** Provenienza della città: `dbip-lite` = stimata, `manual` = corretta. */
  citySource: CitySource | null;
  eventCount: number;
  deviceTypes: DeviceType[];
  status: ContextPeriod['status'];
  userLabel: string | null;
}

/** Range temporale visibile (zoom della Timeline), in unix ms UTC. */
export interface ContextRibbonRange {
  start: number;
  end: number;
}

/** Colore del segmento per `kind` — token del design system (`design/tokens.json`). */
export const CONTEXT_KIND_COLORS: Record<ContextKind, string> = {
  home: '#8B5CF6',
  work: '#EC4899',
  commute: '#F59E0B',
  car: '#10B981',
  travel: '#3B82F6',
  away: '#64748B',
  unknown: '#475569',
};

/**
 * Adatta un `ContextPeriod` del core al view model del nastro.
 *
 * `citySource` è dichiarato dalla fonte quando l'ha (l'evento da cui il
 * periodo è derivato); altrimenti vale la regola di default: **una città
 * presente è una stima**, salvo che l'utente abbia corretto il periodo.
 */
export function toRibbonPeriod(
  period: ContextPeriod,
  citySource: CitySource | null = null,
): ContextRibbonPeriod {
  const source: CitySource | null =
    citySource ?? (period.city && period.status !== 'corrected' ? 'dbip-lite' : null);
  return {
    id: period.id,
    startTime: period.startTime,
    endTime: period.endTime,
    kind: period.kind,
    country: period.country,
    city: period.city,
    citySource: source,
    eventCount: period.eventCount,
    deviceTypes: [...period.deviceTypes],
    status: period.status,
    userLabel: period.userLabel,
  };
}

/** Un periodo interseca il range visibile? (il nastro segue il zoom) */
export function isPeriodVisible(period: ContextRibbonPeriod, range?: ContextRibbonRange): boolean {
  if (!range) return true;
  return period.startTime <= range.end && period.endTime >= range.start;
}

/**
 * La città di un periodo, **secondo la regola di linguaggio della spec**.
 *
 * La città stimata dal database (`citySource = 'dbip-lite'`) entra sempre con
 * l'indicatore di incertezza («circa *X*»); il paese non è soggetto a questa
 * regola, perché è un fatto. Una città corretta a mano
 * (`citySource = 'manual'`) non è più una stima e si mostra piana.
 *
 * Restituisce `null` quando il periodo non ha città.
 */
export function describePeriodCity(period: ContextRibbonPeriod, t: TFunction): string | null {
  if (!period.city) return null;
  return period.citySource === 'manual'
    ? period.city
    : t('timeline.context.city.approx', { city: period.city });
}

/**
 * Etichetta completa di località: paese (fatto) + città (secondo la regola).
 *
 * Restituisce `null` quando il periodo non ha nessuna località da mostrare:
 * il nastro mostra allora solo l'etichetta del `kind`.
 */
export function describePeriodLocation(period: ContextRibbonPeriod, t: TFunction): string | null {
  const parts: string[] = [];
  if (period.country) parts.push(period.country);
  const city = describePeriodCity(period, t);
  if (city) parts.push(city);
  return parts.length > 0 ? parts.join(' · ') : null;
}
