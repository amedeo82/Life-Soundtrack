/**
 * `return` — 04§7.2 (decisione D-A.2).
 *
 * Trigger: oggi hai riascoltato un artista che **non ascoltavi da almeno**
 * `returnMinGapDays` (180) giorni.
 *
 * Il "silenzio" è l'**ultimo** ascolto precedente dell'artista, non il gap
 * più lungo della sua storia: il trigger è "ti è tornato dopo una pausa",
 * non "una volta hai avuto un buco". L'artefatto del ricordo è il brano di
 * **oggi** (`trackId`), non quello di allora: il ricordo riguarda il
 * ritorno.
 */

import { MEMORY_TEMPLATE_KEYS } from './i18n';
import { DAY_MS, eventTime, startOfUtcDay } from './datetime';
import type { MemoryDraft } from './types';
import { artistIdOf, artistNameOf, type MemoryWorkspace } from './workspace';

/** Genera i ricordi `return` del giorno di riferimento. */
export function generateReturn(workspace: MemoryWorkspace): MemoryDraft[] {
  const { context } = workspace;
  const drafts: MemoryDraft[] = [];
  const dayStart = startOfUtcDay(context.today);
  const dayEnd = dayStart + DAY_MS;

  const todayEvents = context.listens.filter((event) => {
    const time = eventTime(event);
    return time >= dayStart && time < dayEnd;
  });

  const todayByArtist = new Map<string, typeof todayEvents>();
  for (const event of todayEvents) {
    const artistId = artistIdOf(workspace, event);
    if (artistId === null) continue;
    const list = todayByArtist.get(artistId);
    if (list) {
      list.push(event);
    } else {
      todayByArtist.set(artistId, [event]);
    }
  }

  for (const [artistId, artistTodayEvents] of todayByArtist) {
    const previous = (workspace.eventsByArtist.get(artistId) ?? []).filter(
      (event) => eventTime(event) < dayStart,
    );
    const last = previous[previous.length - 1];
    if (!last) continue;

    const gapDays = Math.floor((dayStart - eventTime(last)) / DAY_MS);
    if (gapDays < context.config.returnMinGapDays) continue;

    const firstToday = artistTodayEvents[0];
    if (!firstToday) continue;
    const artistName = artistNameOf(workspace, artistId);
    if (artistName === null) continue;

    const trackCount =
      (workspace.eventsByTrack.get(firstToday.trackId) ?? []).filter(
        (event) => eventTime(event) >= dayStart && eventTime(event) < dayEnd,
      ).length || 1;

    drafts.push({
      memoryKind: 'return',
      trackId: firstToday.trackId,
      artistId,
      yearsAgo: null,
      templateKey: MEMORY_TEMPLATE_KEYS.returning,
      templateParams: { artist: artistName, months: Math.floor(gapDays / 30) },
      trackCount,
      daysAgo: gapDays,
      discriminator: artistId,
    });
  }

  return drafts;
}
