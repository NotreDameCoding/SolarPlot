import { fromDayOfYear } from '../dates';
import { frostFromManual, type DailyMin } from '../frost';
import type { Garden, Planting } from '../types';

/** A zone 6 garden: last frost around Apr 20, first frost around Oct 15. */
export const OHIO = frostFromManual('2027-04-20', '2027-10-15', '6a');
/** A short northern season: last frost Jun 1, first frost Sep 5. */
export const MONTANA = frostFromManual('2027-06-01', '2027-09-05', '4a');
/** A hot southern garden: last frost Feb 10, first frost Dec 5. */
export const HOUSTON = frostFromManual('2027-02-10', '2027-12-05', '9b');

export const bed = (cols = 4, rows = 4, over: Partial<Garden> = {}): Garden => ({
  name: 'Test bed', type: 'raised', cols, rows, sun: 'full', sunnySide: 'front', ...over,
});

let n = 0;
export const at = (plantId: string, x: number, y: number, over: Partial<Planting> = {}): Planting => ({
  id: `t${++n}`, plantId, x, y, ...over,
});

/**
 * Fake daily lows for one year: freezing up to `lastFrost` (day of year), freezing again
 * from `firstFrost`, mild in between. Pass null for a year with no frost at all.
 */
export function yearOfLows(year: number, lastFrost: number | null, firstFrost: number | null, coldest = 5): DailyMin[] {
  const days: DailyMin[] = [];
  const length = year % 4 === 0 ? 366 : 365;
  for (let doy = 1; doy <= length; doy++) {
    let minF = 55;
    if (lastFrost !== null && doy <= lastFrost) minF = 28;
    if (firstFrost !== null && doy >= firstFrost) minF = 28;
    if (doy === 15) minF = lastFrost === null ? 40 : coldest;
    days.push({ date: fromDayOfYear(year, doy), minF });
  }
  return days;
}
