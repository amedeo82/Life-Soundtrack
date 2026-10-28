/**
 * `on_this_day` — 04§7.2.
 *
 * Trigger: esiste almeno un evento nella **stessa data** (anno, mese, giorno)
 * di N anni fa, con N ∈ {1, 2, 3, 5, 10} (`onThisDayYears`).
 *
 * Il brano del ricordo è quello più ascoltato in quel giorno; l'artista è
 * quello del brano.
 */

import { MEMORY_TEMPLATE_KEYS } from './i18n';
import { eventTime, utcDateParts } from './datetime';
import type { MemoryDraft } from './types';
import { artistNameOf, type MemoryWorkspace } from './workspace';

/** Genera i ricordi `on_this_day` del giorno di riferimento. */
export function generateOnThisDay(workspace: MemoryWorkspace): MemoryDraft[] {
  const { context } = workspace;
  const drafts: MemoryDraft[] = [];
  const today = utcDateParts(context.today);

  for (const yearsAgo of context.config.onThisDayYears) {
    const targetYear = today.year - yearsAgo;
    const eventsOnDate = context.listens.filter((event) => {
      const parts = utcDateParts(eventTime(event));
      return parts.year === targetYear && parts.month === today.month && parts.day === today.day;
    });
    if (eventsOnDate.length === 0) continue;

    const counts = new Map<string, number>();
    for (const event of eventsOnDate) {
      counts.set(event.trackId, (counts.get(event.trackId) ?? 0) + 1);
    }
    // Ordinamento deterministico: più ascoltati prima, poi id del brano.
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0];
    if (!top) continue;

    const track = context.tracks.get(top[0]);
    if (!track) continue;
    const artistName = artistNameOf(workspace, track.artistId);
    if (artistName === null) continue;

    drafts.push({
      memoryKind: 'on_this_day',
      trackId: track.id,
      artistId: track.artistId,
      yearsAgo,
      templateKey: MEMORY_TEMPLATE_KEYS.onThisDay,
      templateParams: { years: yearsAgo, track: track.name, artist: artistName },
      trackCount: top[1],
      daysAgo: yearsAgo * 365,
      discriminator: String(yearsAgo),
    });
  }

  return drafts;
}
