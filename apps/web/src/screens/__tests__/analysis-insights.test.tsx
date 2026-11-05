/**
 * Test di Analisi (⑩) — Story 3.3, spec `docs/25-MEMORIES-SHARE-EXPLORE.md` §7.
 *
 * Il criterio di accettazione della story è **l'insight in prosa**: ogni
 * grafico è accompagnato da almeno una frase (`insight.*`), mai da un solo
 * valore numerico. Il test lo verifica per contratto, non per caso.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../../i18n';
import { AnalysisScreen } from '../AnalysisScreen';
import { openDb } from '@core/db';
import type { Insight } from '@core/schema';

let dbName = 'ls-analysis-insights-test';

beforeEach(async () => {
  dbName = `ls-analysis-insights-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  const db = await openDb(dbName);
  await db.delete();
  vi.restoreAllMocks();
});

/** Un insight `mood_day`. */
function makeMoodInsight(id: string, month: number, day: number): Insight {
  return {
    id,
    type: 'mood_day',
    periodStart: Date.UTC(2026, month, day),
    periodEnd: Date.UTC(2026, month, day, 23, 59),
    payload: {
      kind: 'mood',
      mood: month === 0 ? 'happy' : 'sad',
      avgValence: month === 0 ? 0.8 : 0.2,
      avgEnergy: month === 0 ? 0.7 : 0.3,
      eventCount: 10,
    },
    confidence: 0.8,
    derivedVersion: 'mood-v1',
    status: 'pending',
    userNote: null,
    createdAt: Date.UTC(2026, month, day),
  };
}

/** Un insight `event` (la frase è **già resa** dal core, D-A.4). */
function makeEventInsight(): Insight {
  return {
    id: 'event-1',
    type: 'event',
    periodStart: Date.UTC(2026, 0, 10),
    periodEnd: Date.UTC(2026, 0, 10, 23, 59),
    payload: {
      kind: 'event',
      eventType: 'spike_artist',
      description: 'Hai scoperto Beatles che ha dominato il tuo ascolto',
      metrics: { artist: 1 },
    },
    confidence: 0.9,
    derivedVersion: 'event-v1',
    status: 'pending',
    userNote: null,
    createdAt: Date.UTC(2026, 0, 10),
  };
}

/** Un insight `memory`. */
function makeMemoryInsight(): Insight {
  return {
    id: 'memory-1',
    type: 'memory',
    periodStart: Date.UTC(2024, 0, 10),
    periodEnd: Date.UTC(2024, 0, 10, 23, 59),
    payload: {
      kind: 'memory',
      memoryKind: 'on_this_day',
      trackId: null,
      artistId: null,
      yearsAgo: 2,
      text: 'Due anni fa ascoltavi "Let It Be" di Beatles',
    },
    confidence: 0.7,
    derivedVersion: 'memory-v1',
    status: 'pending',
    userNote: null,
    createdAt: Date.UTC(2026, 0, 10),
  };
}

async function seed(): Promise<void> {
  const db = await openDb(dbName);
  await db.open();
  await db.insights.bulkPut([
    makeMoodInsight('mood-1', 0, 5),
    makeMoodInsight('mood-2', 0, 20),
    makeMoodInsight('mood-3', 1, 5),
    makeEventInsight(),
    makeMemoryInsight(),
  ]);
}

function renderAnalysis(onFocus = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <AnalysisScreen dbName={dbName} onFocus={onFocus} />
    </I18nextProvider>,
  );
  return onFocus;
}

describe('Analisi (⑩) — la mappa emotiva', () => {
  it('i punti del quadrante sono bottoni con un nome accessibile', async () => {
    await seed();
    renderAnalysis();

    await waitFor(() => {
      expect(screen.getByTestId('quadrant-chart')).toBeTruthy();
    });

    const points = screen.getAllByRole('button', { name: /valence/ });
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('ogni grafico è accompagnato da almeno una frase', async () => {
    await seed();
    renderAnalysis();

    await waitFor(() => {
      expect(screen.getByTestId('quadrant-chart')).toBeTruthy();
    });

    const summary = screen.getByTestId('analysis-summary');
    expect(summary.textContent).toBeTruthy();
    expect(summary.textContent?.trim().split(' ').length).toBeGreaterThan(2);
  });

  it('gli insight sono mostrati in prosa (dal database, non a caldo)', async () => {
    await seed();
    renderAnalysis();

    await waitFor(() => {
      expect(screen.getAllByTestId('insight-card').length).toBe(2);
    });

    const descriptions = screen
      .getAllByTestId('insight-card-description')
      .map((node) => node.textContent ?? '');
    expect(descriptions).toContain('Hai scoperto Beatles che ha dominato il tuo ascolto');
    expect(descriptions).toContain('Due anni fa ascoltavi "Let It Be" di Beatles');
  });

  it('il click su un punto passa il contesto alla Timeline', async () => {
    await seed();
    const onFocus = renderAnalysis();

    await waitFor(() => {
      expect(screen.getByTestId('quadrant-chart')).toBeTruthy();
    });

    const point = screen.getAllByRole('button', { name: /valence/ })[0];
    fireEvent.click(point as HTMLElement);

    expect(onFocus).toHaveBeenCalledTimes(1);
    const focus = onFocus.mock.calls[0]?.[0];
    expect(focus.kind).toBe('period');
    expect(typeof focus.at).toBe('number');
  });

  it("senza dati la schermata dice che non c'e' ancora nulla", async () => {
    const db = await openDb(dbName);
    await db.open();
    renderAnalysis();

    await waitFor(() => {
      expect(screen.getByTestId('analysis-empty')).toBeTruthy();
    });
  });
});
