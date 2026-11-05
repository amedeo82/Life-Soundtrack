/**
 * Test del deep-link alla Timeline — Story 3.3, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §"Navigazione" (D-25.1).
 *
 * Il click su un punto dell'Analisi (⑩) porta alla Timeline (⑦) con il
 * periodo in evidenza: la navigazione è a **stato**, senza router.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../../i18n';
import { Timeline } from '../Timeline';
import { toEraBands } from '../homeTimelineModel';

const eras = toEraBands([
  {
    id: 'era-1',
    startTime: Date.UTC(2026, 0, 1),
    endTime: Date.UTC(2026, 1, 1),
    label: 'Era Uno',
    mood: 'happy',
  },
]);

const volume = [{ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 1, 1), label: '01', value: 10 }];

describe('deep-link alla Timeline (Story 3.3)', () => {
  it("il focus evidenzia l'era che contiene il periodo", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Timeline
          state="ready"
          granularity="months"
          volume={volume}
          mood={volume}
          eras={eras}
          visibleRange={{ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 1, 1) }}
          focus={{ kind: 'period', id: '2026-01', at: Date.UTC(2026, 0, 15) }}
        />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('era-band-era-1').getAttribute('aria-expanded')).toBe('true');
  });

  it('senza focus nessuna era è evidenziata', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Timeline
          state="ready"
          granularity="months"
          volume={volume}
          mood={volume}
          eras={eras}
          visibleRange={{ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 1, 1) }}
        />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('era-band-era-1').getAttribute('aria-expanded')).toBe('false');
  });
});
