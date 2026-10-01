import { describe, expect, it } from 'vitest';
import { areaOf, health, lineHit, overlap, pct } from './stats';
import type { CoverageData } from './types';

const data: CoverageData = {
  title: 't',
  generated: '',
  platforms: ['ios', 'android', 'web'],
  sources: {},
  palette: [],
  files: [{ p: 'a.ts', sums: {}, lc: { '1': [1, 1, 1], '2': [1, 0, 0], '3': [0, 0, 0], '4': [1, 1, 0], '5': [null, 2, 0] } }],
};

describe('stats', () => {
  it('pct treats an empty file as fully covered', () => {
    expect(pct([0, 0])).toBe(100);
    expect(pct([1, 4])).toBe(25);
  });

  it('health thresholds', () => {
    expect([health(95), health(60), health(10)]).toEqual(['good', 'warn', 'bad']);
  });

  it('areaOf groups by the first two segments', () => {
    expect(areaOf('components/office/x/Y.tsx')).toBe('components/office');
    expect(areaOf('app/index.tsx')).toBe('app');
  });

  it('overlap counts who covers each line', () => {
    expect(overlap(data)).toEqual({ all: 1, none: 1, some: 1, only: { ios: 1, android: 1, web: 0 } });
  });

  it('lineHit sums platforms for All and reads one platform otherwise', () => {
    const hits = [2, null, 3];
    expect(lineHit(hits, 'all', data.platforms)).toBe(5);
    expect(lineHit(hits, 'android', data.platforms)).toBeNull();
    expect(lineHit(hits, 'web', data.platforms)).toBe(3);
  });
});
