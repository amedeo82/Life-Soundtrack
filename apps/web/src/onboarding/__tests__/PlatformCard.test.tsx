import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCard } from '../PlatformCard';
import type { PlatformCardStatus } from '../types';

const statuses: PlatformCardStatus[] = [
  'empty',
  'validating',
  'parsing',
  'done',
  'error',
];

describe('PlatformCard — 5 stati canonici (06-UX §2.3, 07-UI-SPEC §2.5)', () => {
  it.each(statuses)('rende lo stato %s con role="button" e aria-describedby', (status) => {
    render(
      <PlatformCard
        platform="spotify"
        status={status}
        {...(status === 'done' ? { count: 10 } : {})}
        fileName="Streaming_History_Audio_2024_0.json"
        onDrop={() => {}}
      />,
    );

    const card = screen.getByTestId('platformcard-spotify');
    expect(card).toBeTruthy();
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('aria-describedby')).not.toBeNull();
    expect(card.getAttribute('data-status')).toBe(status);

    // Ogni stato espone un messaggio di stato annunciabile (aria-live polite)
    const statusEl = card.querySelector('[aria-live="polite"], [id^="platformcard-spotify-status"]');
    expect(statusEl).toBeTruthy();
  });

  it('stato errore mostra il messaggio e il bottone Riprova', () => {
    render(
      <PlatformCard
        platform="spotify"
        status="error"
        error="Questo file sembra di Apple Music, non di Spotify"
        onDrop={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText(/Questo file sembra di Apple Music, non di Spotify/)).toBeTruthy();
    expect(screen.getByTestId('retry-btn')).toBeTruthy();
  });

  it('stato done mostra il badge verde e il conteggio eventi', () => {
    render(
      <PlatformCard
        platform="spotify"
        status="done"
        count={10}
        onDrop={() => {}}
      />,
    );

    expect(screen.getByText(/10 eventi trovati/)).toBeTruthy();
    expect(screen.getByTestId('platformcard-spotify').getAttribute('data-status')).toBe('done');
  });
});
