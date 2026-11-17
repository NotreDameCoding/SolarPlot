import { describe, expect, it } from 'vitest';
import { describeFrost, frostFreeDays, frostFromHistory, frostFromManual, quantile, safeDate, zoneFromMinF, zoneNumber } from '../frost';
import { HOUSTON, OHIO, yearOfLows } from './helpers';

// Ten years where the last frost falls between day 100 and day 118, first frost 280-298.
const TEN_YEARS = Array.from({ length: 10 }, (_, i) => yearOfLows(2016 + i, 100 + i * 2, 280 + i * 2, -5 + i)).flat();

describe('quantile', () => {
  it('returns the middle of an odd list', () => expect(quantile([1, 2, 3], 0.5)).toBe(2));
  it('interpolates between values', () => expect(quantile([10, 20], 0.5)).toBe(15));
  it('returns the ends at 0 and 1', () => {
    expect(quantile([4, 8, 15], 0)).toBe(4);
    expect(quantile([4, 8, 15], 1)).toBe(15);
  });
  it('refuses an empty list', () => expect(() => quantile([], 0.5)).toThrow());
});

describe('frost windows from temperature history', () => {
  const frost = frostFromHistory(TEN_YEARS);
  it('counts the complete years', () => expect(frost.years).toBe(10));
  it('finds the median last spring frost', () => expect(frost.lastSpring?.median).toBe(109));
  it('puts the 10%-risk date after the median', () => {
    expect(frost.lastSpring!.late).toBeGreaterThan(frost.lastSpring!.median);
    expect(frost.lastSpring!.late).toBe(116);
  });
  it('puts the early date before the median', () => expect(frost.lastSpring!.early).toBe(102));
  it('finds the median first fall frost', () => expect(frost.firstFall?.median).toBe(289));
  it('orders the fall window early to late', () => {
    expect(frost.firstFall!.early).toBeLessThan(frost.firstFall!.median);
    expect(frost.firstFall!.median).toBeLessThan(frost.firstFall!.late);
  });
  it('is not frost-free', () => expect(frost.frostFree).toBe(false));
  it('works out the hardiness zone from the coldest nights', () => expect(frost.zone).toBe('6b')); // average -0.5°F
  it('ignores a partial year', () => {
    const partial = yearOfLows(2026, 100, 280).slice(0, 120);
    expect(frostFromHistory([...TEN_YEARS, ...partial]).years).toBe(10);
  });
  it('ignores missing readings', () => {
    const holes = TEN_YEARS.map((d, i) => (i % 50 === 0 ? { ...d, minF: null } : d));
    expect(frostFromHistory(holes).lastSpring?.median).toBe(109);
  });
  it('uses a lighter-frost threshold when asked', () => {
    // At 36°F nothing changes here because the fake data jumps from 28 to 55.
    expect(frostFromHistory(TEN_YEARS, 36).lastSpring?.median).toBe(109);
    expect(frostFromHistory(TEN_YEARS, 20).lastSpring?.median).toBe(15); // only the mid-January cold snap counts
  });
  it('recognises a frost-free climate', () => {
    const tropical = Array.from({ length: 10 }, (_, i) => yearOfLows(2016 + i, null, null)).flat();
    const f = frostFromHistory(tropical);
    expect(f.frostFree).toBe(true);
    expect(f.lastSpring).toBeNull();
    expect(f.zone).toBe('11a');
  });
  it('gives no windows from too few years', () => {
    const f = frostFromHistory(yearOfLows(2024, 100, 280));
    expect(f.lastSpring).toBeNull();
    expect(f.frostFree).toBe(false);
  });
  it('handles no data at all', () => {
    const f = frostFromHistory([]);
    expect(f.years).toBe(0);
    expect(f.zone).toBeNull();
  });
});

describe('hardiness zones', () => {
  it('maps -10°F to 6a', () => expect(zoneFromMinF(-10)).toBe('6a'));
  it('maps -3°F to 6b', () => expect(zoneFromMinF(-3)).toBe('6b'));
  it('maps 25°F to 9b', () => expect(zoneFromMinF(25)).toBe('9b'));
  it('maps -60°F and colder to 1a', () => expect(zoneFromMinF(-75)).toBe('1a'));
  it('reads the number out of a zone', () => {
    expect(zoneNumber('9b')).toBe(9);
    expect(zoneNumber('10a')).toBe(10);
    expect(zoneNumber(null)).toBeNull();
  });
});

describe('frost dates typed in by hand', () => {
  it('spreads two weeks either side of the date given', () => {
    const f = frostFromManual('2027-04-20', '2027-10-15');
    expect(f.lastSpring).toEqual({ early: 96, median: 110, late: 124 });
    expect(f.source).toBe('manual');
  });
  it('measures the frost-free season', () => expect(frostFreeDays(OHIO)).toBe(178));
  it('gives tender crops the 10%-risk date', () => expect(safeDate(OHIO, 2027)).toBe('2027-05-04'));
  it('describes the windows in plain words', () => {
    expect(describeFrost(OHIO, 2027)).toBe('Last spring frost usually between Apr 6 and May 4. First fall frost usually between Oct 1 and Oct 29.');
  });
  it('treats a long southern season as long', () => expect(frostFreeDays(HOUSTON)).toBe(298));
});
