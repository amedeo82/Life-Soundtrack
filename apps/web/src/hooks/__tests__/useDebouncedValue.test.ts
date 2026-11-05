import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from '../useDebouncedValue';

/**
 * Test del debounce della ricerca — Story 3.3 (`docs/06-UX-FLOWS-STATES.md` §2.9).
 *
 * Il debounce è **300 ms**: ogni tasto premuto ricalcolerebbe i risultati su
 * tutto il catalogo.
 */
describe('useDebouncedValue (Story 3.3)', () => {
  it('ritarda il valore di 300 ms', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
        initialProps: { value: 'a' },
      });

      expect(result.current).toBe('a');

      rerender({ value: 'ab' });
      expect(result.current).toBe('a');

      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
      expect(result.current).toBe('ab');
    } finally {
      vi.useRealTimers();
    }
  });

  it('un valore nuovo prima della scadenza rimanda la scadenza', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
        initialProps: { value: 'a' },
      });

      rerender({ value: 'ab' });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      rerender({ value: 'abc' });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe('a');

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('abc');
    } finally {
      vi.useRealTimers();
    }
  });
});
