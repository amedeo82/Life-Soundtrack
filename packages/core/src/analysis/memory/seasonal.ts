/**
 * `seasonal` — 04§7.2 (decisione D-A.2).
 *
 * Trigger: un **genere** che ascolti prevalentemente in questo mese (≥
 * `seasonalConcentration` = 60% dei suoi ascolti negli **ultimi 12 mesi**) e
 * che **quest'anno** hai riascoltato in quel mese.
 *
 * La concentrazione è calcolata sui 12 mesi precedenti, non sull'intera
 * storia: altrimenti un ascolto del 2019 "peserebbe" per sempre e il ricordo
 * diventerebbe un fatto storico invece di una stagionalità.
 *
 * Il ricordo stagionale è **per genere** (non per artista): il testo ne porta
 * il nome. `MemoryPayload` (02§4) non ha un campo `genre`, quindi
 * l'informazione vive nel `text` reso (D-A.4).
 */

import { MEMORY_TEMPLATE_KEYS } from './i18n';
import { DAY_MS, eventTime, localizedMonthName, utcMonth, utcYear } from './datetime';
import type { MemoryDraft } from './types';
import type { MemoryWorkspace } from './workspace';

/** Genera i ricordi `seasonal` del giorno di riferimento. */
export function generateSeasonal(workspace: MemoryWorkspace): MemoryDraft[] {
  const { context } = workspace;
  const drafts: MemoryDraft[] = [];
  const currentMonth = utcMonth(context.today);
  const currentYear = utcYear(context.today);
  const windowStart = context.today - 365 * DAY_MS;

  const window = context.listens.filter((event) => {
    const time = eventTime(event);
    return time >= windowStart && time <= context.today;
  });

  const eventsByGenre = new Map<string, typeof window>();
  for (const event of window) {
    const track = context.tracks.get(event.trackId);
    if (!track) continue;
    for (const genre of track.genres) {
      const list = eventsByGenre.get(genre);
      if (list) {
        list.push(event);
      } else {
        eventsByGenre.set(genre, [event]);
      }
    }
  }

  for (const [genre, genreEvents] of eventsByGenre) {
    if (genreEvents.length < context.config.seasonalMinEvents) continue;

    const inMonth = genreEvents.filter((event) => utcMonth(eventTime(event)) === currentMonth);
    if (inMonth.length === 0) continue;

    const monthShare = inMonth.length / genreEvents.length;
    if (monthShare < context.config.seasonalConcentration) continue;

    const thisYear = inMonth.filter((event) => utcYear(eventTime(event)) === currentYear);
    if (thisYear.length === 0) continue;

    drafts.push({
      memoryKind: 'seasonal',
      trackId: null,
      artistId: null,
      yearsAgo: null,
      templateKey: MEMORY_TEMPLATE_KEYS.seasonal,
      templateParams: {
        month: localizedMonthName(currentMonth, context.locale),
        genre,
      },
      trackCount: genreEvents.length,
      daysAgo: 0,
      discriminator: genre,
    });
  }

  return drafts;
}
