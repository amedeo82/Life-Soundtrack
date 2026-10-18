import { describe, expect, it } from 'vitest';
import type { SemverTuple } from '../hooks/useAppUpdate';
import {
  classifyUpdate,
  compareSemver,
  formatSemver,
  parseSemver,
} from '../hooks/useAppUpdate';

describe('parseSemver', () => {
  it.each([
    ['1.2.3', [1, 2, 3]],
    ['0.1.0', [0, 1, 0]],
    ['v1.2.3', [1, 2, 3]],
    ['  10.20.30  ', [10, 20, 30]],
  ])('parse %s → %s', (input, expected) => {
    expect(parseSemver(input)).toEqual(expected);
  });

  it.each(['', null, undefined, '1.2', 'abc', '1.2.3.4', 'a.b.c'])(
    'respinge input invalido: %s',
    (input) => {
      expect(parseSemver(input as string | null | undefined)).toBeNull();
    },
  );
});

describe('compareSemver', () => {
  const cases: Array<[SemverTuple, SemverTuple, -1 | 0 | 1]> = [
    [[1, 2, 3], [1, 2, 3], 0],
    [[1, 2, 3], [1, 2, 4], -1],
    [[1, 2, 4], [1, 2, 3], 1],
    [[2, 0, 0], [1, 99, 99], 1],
    [[0, 99, 99], [1, 0, 0], -1],
    [[10, 0, 0], [9, 99, 99], 1],
  ];
  for (const [a, b, expected] of cases) {
    it(`${a.join('.')} vs ${b.join('.')} → ${expected}`, () => {
      expect(compareSemver(a, b)).toBe(expected);
    });
  }
});

describe('classifyUpdate', () => {
  const cases: Array<{
    name: string;
    current: SemverTuple | null;
    next: SemverTuple;
    expected: 'minor' | 'patch' | 'major';
  }> = [
    { name: 'no current → minor', current: null, next: [1, 0, 0], expected: 'minor' },
    { name: 'patch', current: [1, 0, 0], next: [1, 0, 1], expected: 'patch' },
    { name: 'minor', current: [1, 0, 0], next: [1, 1, 0], expected: 'minor' },
    { name: 'minor (patch sul minor)', current: [1, 0, 5], next: [1, 1, 0], expected: 'minor' },
    { name: 'major', current: [1, 9, 9], next: [2, 0, 0], expected: 'major' },
    { name: 'uguale', current: [1, 0, 0], next: [1, 0, 0], expected: 'patch' },
  ];

  it.each(cases)('$name', (tc) => {
    expect(classifyUpdate(tc.current, tc.next)).toBe(tc.expected);
  });
});

describe('formatSemver', () => {
  const cases: Array<[SemverTuple, string]> = [
    [[0, 1, 0], '0.1.0'],
    [[1, 2, 3], '1.2.3'],
    [[10, 20, 30], '10.20.30'],
  ];
  for (const [input, expected] of cases) {
    it(`${input.join('.')} → ${expected}`, () => {
      expect(formatSemver(input)).toBe(expected);
    });
  }
});
