/**
 * `first_time` — 04§7.2 (decisione D-A.3).
 *
 * Trigger: oggi è l'anniversario del **primo ascolto** di un artista
 * significativo, cioè un artista con almeno `firstTimeMinTracks` (5) **brani
 * distinti** — non 5 ascolti: un artista con un solo brano ascoltato cinque
 * volte non è "significativo".
 */

import { MEMORY_TEMPLATE_KEYS } from './i18n';
import { eventTime, isSameUtcMonthDay, utcYear } from './datetime';
import type { MemoryDraft } from './types';
import { artistNameOf, type MemoryWorkspace } from './workspace';

/** Genera i ricordi `first_time` del giorno di riferimento. */
export function generateFirstTime(workspace: MemoryWorkspace): MemoryDraft[] {
  const { context } = workspace;
  const drafts: MemoryDraft[] = [];

  for (const [artistId, artistEvents] of workspace.eventsByArtist) {
    const first = artistEvents[0];
    if (!first) continue;
    const firstTime = eventTime(first);
    if (!isSameUtcMonthDay(firstTime, context.today)) continue;

    const yearsAgo = utcYear(context.today) - utcYear(firstTime);
    if (yearsAgo < 1) continue;

    const distinctTracks = new Set(artistEvents.map((event) => event.trackId)).size;
    if (distinctTracks < context.config.firstTimeMinTracks) continue;

    const artistName = artistNameOf(workspace, artistId);
    if (artistName === null) continue;

    drafts.push({
      memoryKind: 'first_time',
      trackId: null,
      artistId,
      yearsAgo,
      templateKey: MEMORY_TEMPLATE_KEYS.firstTime,
      templateParams: { years: yearsAgo, artist: artistName },
      trackCount: artistEvents.length,
      daysAgo: yearsAgo * 365,
      discriminator: artistId,
    });
  }

  return drafts;
}
