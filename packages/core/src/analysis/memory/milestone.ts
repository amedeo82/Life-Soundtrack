/**
 * `milestone` — 04§7.2.
 *
 * Trigger: raggiungimento di soglie cumulative. Le tre famiglie sono
 * elencate nel trigger della spec — ascolti totali (`milestones`), ore di
 * ascolto (`milestoneHours`) e artisti unici (`milestoneArtists`).
 *
 * La soglia scatta **nel giorno in cui viene raggiunta**: il totale deve
 * essere esattamente la soglia, non maggiore. Così un ricordo da milestone
 * è un fatto ("il millesimo ascolto"), non una banda che si riattiva ogni
 * giorno.
 */

import { MEMORY_TEMPLATE_KEYS } from './i18n';
import { HOUR_MS } from './datetime';
import type { MemoryDraft } from './types';
import type { MemoryWorkspace } from './workspace';

/** Genera i ricordi `milestone` del giorno di riferimento. */
export function generateMilestone(workspace: MemoryWorkspace): MemoryDraft[] {
  const { context } = workspace;
  const drafts: MemoryDraft[] = [];
  const totalEvents = context.listens.length;

  for (const threshold of context.config.milestones) {
    if (totalEvents !== threshold) continue;
    drafts.push({
      memoryKind: 'milestone',
      trackId: null,
      artistId: null,
      yearsAgo: null,
      templateKey: MEMORY_TEMPLATE_KEYS.milestoneEvents,
      templateParams: { count: threshold },
      trackCount: totalEvents,
      daysAgo: 0,
      discriminator: `events-${threshold}`,
    });
  }

  const totalDurationMs = context.listens.reduce((sum, event) => sum + event.durationMs, 0);
  const totalHours = Math.floor(totalDurationMs / HOUR_MS);
  for (const threshold of context.config.milestoneHours) {
    if (totalHours !== threshold) continue;
    drafts.push({
      memoryKind: 'milestone',
      trackId: null,
      artistId: null,
      yearsAgo: null,
      templateKey: MEMORY_TEMPLATE_KEYS.milestoneHours,
      templateParams: { count: threshold },
      trackCount: totalEvents,
      daysAgo: 0,
      discriminator: `hours-${threshold}`,
    });
  }

  const artistCount = workspace.eventsByArtist.size;
  for (const threshold of context.config.milestoneArtists) {
    if (artistCount !== threshold) continue;
    drafts.push({
      memoryKind: 'milestone',
      trackId: null,
      artistId: null,
      yearsAgo: null,
      templateKey: MEMORY_TEMPLATE_KEYS.milestoneArtists,
      templateParams: { count: threshold },
      trackCount: artistCount,
      daysAgo: 0,
      discriminator: `artists-${threshold}`,
    });
  }

  return drafts;
}
