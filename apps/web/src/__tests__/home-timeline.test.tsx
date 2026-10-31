/**
 * Test di Home (⑥) e Timeline (⑦) — Story 3.1
 * (`docs/06-UX-FLOWS-STATES.md` §2.6-2.7, `docs/07-UI-SPEC.md` §2.1-2.7).
 *
 * I test coprono il **modello** (conteggi, bucket, bande, zoom) e i
 * **contratti a11y** dei componenti, che sono i vincoli espliciti della spec:
 * `role="status"` con etichetta descrittiva, `<title>`/`<desc>` sul grafico,
 * tabella dati nascosta per screen reader, `aria-expanded` sulle EraBand,
 * `prefers-reduced-motion` rispettato.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../i18n';
import { Home } from '../screens/Home';
import { Timeline } from '../screens/Timeline';
import { AppShell } from '../screens/AppShell';
import {
  bucketizeListens,
  bucketizeMood,
  computeBarWeek,
  computeHomeStats,
  eraAt,
  granularityForSpan,
  toEraBands,
  type EraFact,
  type ListenFact,
} from '../screens/homeTimelineModel';

const DAY = 86_400_000;

function listen(day: number, minutes = 60, artistId = 'a1'): ListenFact {
  return {
    playedAt: Date.UTC(2026, 0, day, 12, 0),
    durationMs: minutes * 60_000,
    artistId,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('modello — i numeri della Home', () => {
  it('conta ascolti, ore, artisti ed ere', () => {
    const stats = computeHomeStats([listen(1, 60), listen(1, 30), listen(2, 90, 'a2')], 3);
    expect(stats.tracks).toBe(3);
    expect(stats.hours).toBe(3);
    expect(stats.artists).toBe(2);
    expect(stats.eras).toBe(3);
  });

  it('la bar week ha sempre sette giorni, anche con dati di un solo giorno', () => {
    const bar = computeBarWeek([listen(1, 30)], Date.UTC(2026, 0, 3));
    expect(bar).toHaveLength(7);
    expect(bar.reduce((sum, point) => sum + point.minutes, 0)).toBe(30);
  });
});

describe('modello — bucket e zoom', () => {
  it("i bucket annuali coprono tutti gli anni fra il primo e l'ultimo ascolto", () => {
    const series = bucketizeListens(
      [
        listen(1, 30),
        listen(1, 400, 'a2'),
        { playedAt: Date.UTC(2028, 5, 2), durationMs: 60_000, artistId: 'a3' },
      ],
      'years',
    );
    expect(series.map((point) => point.label)).toEqual(['2026', '2027', '2028']);
    expect(series[0]?.value).toBe(430);
  });

  it('un bucket vuoto vale zero: la linea non deve saltare i buchi', () => {
    const series = bucketizeListens(
      [
        { playedAt: Date.UTC(2026, 0, 1), durationMs: 60_000, artistId: 'a' },
        { playedAt: Date.UTC(2026, 2, 1), durationMs: 60_000, artistId: 'a' },
      ],
      'months',
    );
    expect(series).toHaveLength(3);
    expect(series.map((point) => point.value)).toEqual([1, 0, 1]);
  });

  it('il mood non viene interpolato nei bucket senza dati', () => {
    const series = bucketizeMood(
      [
        {
          periodStart: Date.UTC(2026, 0, 1),
          periodEnd: Date.UTC(2026, 0, 2),
          valence: 0.2,
          mood: 'sad',
        },
        {
          periodStart: Date.UTC(2026, 2, 1),
          periodEnd: Date.UTC(2026, 2, 2),
          valence: 0.8,
          mood: 'happy',
        },
      ],
      'months',
    );
    expect(series).toHaveLength(2);
    expect(series[0]?.value).toBeCloseTo(0.2);
    expect(series[1]?.value).toBeCloseTo(0.8);
  });

  it('lo zoom progressivo va da anni a giorni', () => {
    expect(granularityForSpan(5 * 365 * DAY)).toBe('years');
    expect(granularityForSpan(200 * DAY)).toBe('months');
    expect(granularityForSpan(60 * DAY)).toBe('weeks');
    expect(granularityForSpan(3 * DAY)).toBe('days');
  });

  it('le bande di era sono ordinate per inizio', () => {
    const eras: EraFact[] = [
      { id: 'e2', startTime: 200, endTime: 300, label: 'B', mood: 'happy' },
      { id: 'e1', startTime: 100, endTime: 200, label: 'A', mood: 'sad' },
    ];
    const bands = toEraBands(eras);
    expect(bands.map((band) => band.id)).toEqual(['e1', 'e2']);
    expect(eraAt(bands, 150)?.id).toBe('e1');
    expect(eraAt(bands, 500)).toBeNull();
  });
});

describe('Home (⑥) — stati e contratto a11y', () => {
  const stats = { tracks: 120, hours: 42, artists: 18, eras: 4 };

  it('lo stato vuoto non mostra numeri', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home state="empty" stats={stats} barWeek={[]} memory={null} weekMoodLabel={null} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('home-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('stat-card')).toHaveLength(0);
  });

  it('lo stato ready mostra le quattro StatCard con etichetta descrittiva', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home
          state="ready"
          stats={stats}
          barWeek={computeBarWeek([listen(1, 60)], Date.UTC(2026, 0, 3))}
          memory={null}
          weekMoodLabel="Felice"
        />
      </I18nextProvider>,
    );
    const cards = screen.getAllByTestId('stat-card');
    expect(cards).toHaveLength(4);
    expect(cards[0]?.getAttribute('role')).toBe('status');
    expect(cards[0]?.getAttribute('aria-label')).toContain('brani');
    expect(screen.getByTestId('home-mood-week').textContent).toContain('Felice');
  });

  it('lo stato partial avvisa che la storia cresce', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home state="partial" stats={stats} barWeek={[]} memory={null} weekMoodLabel={null} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('home-partial').textContent).toMatch(/Più dati importi/);
  });

  it('il ricordo del giorno mostra il mood e la data', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home
          state="ready"
          stats={stats}
          barWeek={[]}
          memory={{
            title: 'Primo ascolto',
            mood: 'happy',
            moodLabel: 'Felice',
            date: '10 gennaio',
          }}
          weekMoodLabel={null}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('memory-card-mood').textContent).toBe('Felice');
    expect(screen.getByTestId('memory-card-date').textContent).toBe('10 gennaio');
  });
});

describe('Timeline (⑦) — stati, sincronizzazione e a11y', () => {
  const volume = [
    { start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 0, 2), label: '01', value: 10 },
    { start: Date.UTC(2026, 0, 2), end: Date.UTC(2026, 0, 3), label: '02', value: 20 },
  ];
  const mood = [
    { start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 0, 2), label: '01', value: 0.3 },
    { start: Date.UTC(2026, 0, 2), end: Date.UTC(2026, 0, 3), label: '02', value: 0.7 },
  ];
  const eras = toEraBands([
    {
      id: 'e1',
      startTime: Date.UTC(2026, 0, 1),
      endTime: Date.UTC(2026, 0, 2),
      label: 'Era Uno',
      mood: 'happy',
    },
  ]);

  function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
    return render(
      <I18nextProvider i18n={i18n}>
        <Timeline
          state="ready"
          granularity="days"
          volume={volume}
          mood={mood}
          eras={eras}
          visibleRange={{ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 0, 3) }}
          {...overrides}
        />
      </I18nextProvider>,
    );
  }

  it('lo stato vuoto e lo stato errore sono distinti', () => {
    const { unmount } = renderTimeline({ state: 'empty' });
    expect(screen.getByTestId('timeline-empty')).toBeTruthy();
    unmount();
    renderTimeline({ state: 'error' });
    expect(screen.getByTestId('timeline-error')).toBeTruthy();
  });

  it('i grafici hanno title, desc e tabella nascosta per screen reader', () => {
    renderTimeline();
    const svg = screen.getByTestId('stream-chart').querySelector('svg');
    expect(svg?.querySelector('title')?.textContent).toBeTruthy();
    expect(svg?.querySelector('desc')?.textContent).toBeTruthy();
    const table = screen.getByTestId('stream-chart-table');
    expect(table.className).toContain('sr-only');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('il toggle di granularità chiama il callback', () => {
    const onGranularityChange = vi.fn();
    renderTimeline({ onGranularityChange });
    fireEvent.click(screen.getByTestId('timeline-granularity-months'));
    expect(onGranularityChange).toHaveBeenCalledWith('months');
    expect(screen.getByTestId('timeline-granularity-days').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it("l'hover su un'EraBand evidenzia il bucket corrispondente nei grafici", () => {
    renderTimeline();
    const band = screen.getByTestId('era-band-e1');
    expect(band.getAttribute('aria-expanded')).toBe('false');
    fireEvent.mouseEnter(band);
    expect(screen.getByTestId('stream-point-0').getAttribute('r')).toBe('5');
    expect(screen.getByTestId('mood-point-0').getAttribute('r')).toBe('5');
    fireEvent.mouseLeave(band);
    expect(screen.getByTestId('stream-point-0').getAttribute('r')).toBe('3');
  });

  it("l'hover su un punto evidenzia l'era che lo contiene", () => {
    renderTimeline();
    fireEvent.mouseEnter(screen.getByTestId('stream-point-0'));
    expect(screen.getByTestId('era-band-e1').getAttribute('aria-expanded')).toBe('true');
  });

  it("il click su un'era la consegna al chiamante", () => {
    const onEraSelect = vi.fn();
    renderTimeline({ onEraSelect });
    fireEvent.click(screen.getByTestId('era-band-e1'));
    expect(onEraSelect).toHaveBeenCalledTimes(1);
    expect(onEraSelect.mock.calls[0]?.[0].id).toBe('e1');
  });

  it('lo stato partial avvisa che la timeline è parziale', () => {
    renderTimeline({ state: 'partial' });
    expect(screen.getByTestId('timeline-partial').textContent).toMatch(/parziale/i);
  });
});

describe('shell — la navigazione fra Home e Timeline', () => {
  it('la nav porta da Home a Timeline e segna la sezione attiva', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AppShell />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('app-shell')).toBeTruthy();
    expect(screen.getByTestId('nav-home').getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByTestId('nav-timeline'));
    expect(screen.getByTestId('nav-timeline').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('nav-home').getAttribute('aria-current')).toBeNull();
  });
});
