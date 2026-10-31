/**
 * Test del nastro contesto — Story 3.4 (`docs/19-GEO-CONTEXT.md` §8.2).
 *
 * I test coprono i quattro acceptance criteria della story e le due regole
 * strutturali della spec:
 *
 * - il paese è un fatto, la città è **sempre** introdotta da un indicatore di
 *   incertezza e non compare mai come fatto;
 * - il nastro **non** effettua richieste di rete e non carica alcuna mappa;
 * - il periodo senza contesto determinato resta `unknown` e non viene
 *   aggregato;
 * - le azioni utente aggiornano lo `status` del periodo.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../i18n';
import { ContextRibbon } from '../components/ContextRibbon';
import {
  describePeriodCity,
  isPeriodVisible,
  toRibbonPeriod,
  type ContextRibbonPeriod,
} from '../components/contextRibbonModel';
import { ContextPeriodDetail } from '../components/ContextPeriodDetail';

const PERIOD_BASE = {
  id: 'p1',
  startTime: Date.UTC(2026, 0, 10, 8, 0),
  endTime: Date.UTC(2026, 0, 10, 10, 0),
  kind: 'home' as const,
  country: 'IT',
  city: null,
  citySource: null,
  eventCount: 12,
  deviceTypes: ['mobile' as const],
  status: 'pending' as const,
  userLabel: null,
};

function period(overrides: Partial<ContextRibbonPeriod> = {}): ContextRibbonPeriod {
  return { ...PERIOD_BASE, ...overrides };
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nastro contesto — regola di linguaggio (19§8.3)', () => {
  it('mostra il paese come fatto', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon periods={[period({ country: 'IT' })]} />
      </I18nextProvider>,
    );
    const segment = screen.getByTestId('context-segment-p1');
    expect(segment.textContent).toContain('IT');
    expect(segment.textContent).not.toMatch(/circa\s+IT/);
  });

  it('mostra la città stimata solo come «circa X»', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon
          periods={[period({ country: 'IT', city: 'Milano', citySource: 'dbip-lite' })]}
        />
      </I18nextProvider>,
    );
    const segment = screen.getByTestId('context-segment-p1');
    expect(segment.textContent).toContain('circa Milano');
  });

  it('mostra la città corretta a mano senza indicatore di incertezza', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon
          periods={[period({ country: 'IT', city: 'Milano', citySource: 'manual' })]}
        />
      </I18nextProvider>,
    );
    const segment = screen.getByTestId('context-segment-p1');
    expect(segment.textContent).toContain('Milano');
    expect(segment.textContent).not.toContain('circa');
  });

  it('la regola vale anche in inglese', () => {
    const t = i18n.getFixedT('en');
    expect(describePeriodCity(period({ city: 'Milan', citySource: 'dbip-lite' }), t)).toBe(
      'around Milan',
    );
    expect(describePeriodCity(period({ city: 'Milan', citySource: 'manual' }), t)).toBe('Milan');
  });
});

describe('nastro contesto — AC strutturali', () => {
  it('non effettua richieste di rete e non carica alcuna mappa', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon
          periods={[period({ country: 'IT', city: 'Milano', citySource: 'dbip-lite' })]}
        />
      </I18nextProvider>,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.innerHTML).not.toMatch(/mapbox|leaflet|openstreetmap|tile/i);
  });

  it('il periodo non determinato resta «unknown» e non viene aggregato', () => {
    const periods = [
      period({ id: 'u1', kind: 'unknown', country: null, city: null, eventCount: 3 }),
      period({ id: 'u2', kind: 'unknown', country: null, city: null, eventCount: 2 }),
    ];
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon periods={periods} />
      </I18nextProvider>,
    );
    // un segmento per periodo: nessun'aggregazione dei due `unknown`
    expect(screen.getByTestId('context-segment-u1')).toBeTruthy();
    expect(screen.getByTestId('context-segment-u2')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('context-segment-u1').textContent).toContain('Non determinato');
  });

  it('un segmento per periodo, con i pips dei dispositivi', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon periods={[period({ deviceTypes: ['mobile', 'desktop'] })]} />
      </I18nextProvider>,
    );
    const segment = screen.getByTestId('context-segment-p1');
    expect(segment.querySelectorAll('.context-ribbon__pip')).toHaveLength(2);
    expect(segment.querySelector('[data-device="mobile"]')).toBeTruthy();
    expect(segment.querySelector('[data-device="desktop"]')).toBeTruthy();
  });

  it('il nastro segue il zoom: mostra solo i periodi nel range visibile', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon
          periods={[
            period({ id: 'in', startTime: 1000, endTime: 2000 }),
            period({ id: 'out', startTime: 900000, endTime: 950000 }),
          ]}
          visibleRange={{ start: 0, end: 5000 }}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('context-segment-in')).toBeTruthy();
    expect(screen.queryByTestId('context-segment-out')).toBeNull();
  });

  it('i filtri per kind, paese e dispositivo restringono i segmenti', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon
          periods={[
            period({ id: 'a', kind: 'home', country: 'IT', deviceTypes: ['mobile'] }),
            period({ id: 'b', kind: 'work', country: 'FR', deviceTypes: ['desktop'] }),
          ]}
        />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByTestId('context-filter-kind'), { target: { value: 'work' } });
    expect(screen.queryByTestId('context-segment-a')).toBeNull();
    expect(screen.getByTestId('context-segment-b')).toBeTruthy();

    fireEvent.change(screen.getByTestId('context-filter-kind'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('context-filter-country'), { target: { value: 'IT' } });
    expect(screen.getByTestId('context-segment-a')).toBeTruthy();
    expect(screen.queryByTestId('context-segment-b')).toBeNull();

    fireEvent.change(screen.getByTestId('context-filter-country'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('context-filter-device'), { target: { value: 'desktop' } });
    expect(screen.queryByTestId('context-segment-a')).toBeNull();
    expect(screen.getByTestId('context-segment-b')).toBeTruthy();
  });

  it('il click su un segmento restituisce il periodo scelto', () => {
    const onSelect = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ContextRibbon periods={[period()]} onSelect={onSelect} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('context-segment-p1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0].id).toBe('p1');
  });

  it('il default del view model: una città presente e non corretta è una stima', () => {
    const core = {
      ...PERIOD_BASE,
      city: 'Milano',
      derivedVersion: 'v1',
      confidence: 0.8,
      createdAt: 0,
    };
    const adapted = toRibbonPeriod(core);
    expect(adapted.citySource).toBe('dbip-lite');

    const corrected = toRibbonPeriod({ ...core, status: 'corrected' });
    expect(corrected.citySource).toBeNull();
  });

  it('isPeriodVisible: un periodo che tocca il bordo del range è visibile', () => {
    expect(
      isPeriodVisible(period({ startTime: 100, endTime: 200 }), { start: 200, end: 300 }),
    ).toBe(true);
    expect(
      isPeriodVisible(period({ startTime: 100, endTime: 199 }), { start: 200, end: 300 }),
    ).toBe(false);
  });
});

describe('dettaglio del periodo — azioni utente', () => {
  it('conferma, correzione e dismiss aggiornano lo status del periodo', () => {
    const onVerdict = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ContextPeriodDetail period={period()} onVerdict={onVerdict} />
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByTestId('context-detail-confirm'));
    expect(onVerdict).toHaveBeenLastCalledWith('p1', { status: 'confirmed', userLabel: null });

    fireEvent.change(screen.getByTestId('context-detail-label-input'), {
      target: { value: 'Casa di mia madre' },
    });
    fireEvent.click(screen.getByTestId('context-detail-correct'));
    expect(onVerdict).toHaveBeenLastCalledWith('p1', {
      status: 'corrected',
      userLabel: 'Casa di mia madre',
    });

    fireEvent.click(screen.getByTestId('context-detail-dismiss'));
    expect(onVerdict).toHaveBeenLastCalledWith('p1', {
      status: 'dismissed',
      userLabel: 'Casa di mia madre',
    });
  });

  it('mostra la città stimata con l’indicatore di incertezza anche nel dettaglio', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextPeriodDetail period={period({ city: 'Milano', citySource: 'dbip-lite' })} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('context-detail-city').textContent).toBe('circa Milano');
  });

  it('elenca gli eventi del periodo', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContextPeriodDetail
          period={period()}
          events={[{ id: 'e1', title: 'A Song', artist: 'An Artist', playedAt: 0 }]}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('context-detail-events').textContent).toContain('A Song');
    expect(screen.getByTestId('context-detail-event-count').textContent).toContain('12');
  });
});
