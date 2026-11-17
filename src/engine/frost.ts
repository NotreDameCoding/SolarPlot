import { dayOfYear, fmtDate, fromDayOfYear } from './dates';
import type { ISO } from './types';

/**
 * A frost date as a risk window, in day-of-year numbers.
 * For the last spring frost: by `early` 90% of years still have a frost ahead,
 * by `median` half do, and by `late` only 10% do.
 * For the first fall frost: `early` is the 10%-risk date, `late` the 90% one.
 */
export interface FrostWindow {
  early: number;
  median: number;
  late: number;
}

export interface FrostInfo {
  lastSpring: FrostWindow | null;
  firstFall: FrostWindow | null;
  /** True where most years have no frost at all. */
  frostFree: boolean;
  /** How many years of records the windows come from (0 for manual entry). */
  years: number;
  /** USDA-style hardiness zone such as '6b', worked out from the coldest night of each year. */
  zone: string | null;
  source: 'history' | 'manual';
}

export interface DailyMin {
  date: ISO;
  minF: number | null;
}

const MIDSUMMER = 182; // July 1: frosts before it are "spring", after it are "fall"

/** Linear-interpolated quantile of an ascending list. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) throw new Error('quantile of an empty list');
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function windowOf(values: number[]): FrostWindow | null {
  if (values.length < 3) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    early: Math.round(quantile(s, 0.1)),
    median: Math.round(quantile(s, 0.5)),
    late: Math.round(quantile(s, 0.9)),
  };
}

/** Average coldest night of the year -> hardiness zone, e.g. -3°F -> '6b'. */
export function zoneFromMinF(avgAnnualMinF: number): string {
  const steps = Math.floor((avgAnnualMinF + 60) / 5); // half-zones of 5°F starting at 1a
  const clamped = Math.max(0, Math.min(25, steps));
  return `${Math.floor(clamped / 2) + 1}${clamped % 2 === 0 ? 'a' : 'b'}`;
}

export function zoneNumber(zone: string | null): number | null {
  if (!zone) return null;
  const n = parseInt(zone, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Work out frost windows from several years of daily low temperatures.
 * A "frost" is any day at or below `thresholdF` (32°F by default).
 */
export function frostFromHistory(days: DailyMin[], thresholdF = 32): FrostInfo {
  const byYear = new Map<number, { doy: number; minF: number }[]>();
  for (const d of days) {
    if (d.minF === null || !Number.isFinite(d.minF)) continue;
    const year = Number(d.date.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ doy: dayOfYear(d.date), minF: d.minF });
  }

  const lastSpring: number[] = [];
  const firstFall: number[] = [];
  const annualMins: number[] = [];
  let years = 0;
  let yearsWithFrost = 0;

  for (const list of byYear.values()) {
    if (list.length < 300) continue; // skip partial years
    years++;
    let last: number | null = null;
    let first: number | null = null;
    let coldest = Infinity;
    for (const { doy, minF } of list) {
      coldest = Math.min(coldest, minF);
      if (minF > thresholdF) continue;
      if (doy <= MIDSUMMER) last = last === null ? doy : Math.max(last, doy);
      else first = first === null ? doy : Math.min(first, doy);
    }
    annualMins.push(coldest);
    if (last !== null || first !== null) yearsWithFrost++;
    if (last !== null) lastSpring.push(last);
    if (first !== null) firstFall.push(first);
  }

  const frostFree = years > 0 && yearsWithFrost / years < 0.5;
  const avgMin = annualMins.length ? annualMins.reduce((a, b) => a + b, 0) / annualMins.length : null;
  return {
    lastSpring: frostFree ? null : windowOf(lastSpring),
    firstFall: frostFree ? null : windowOf(firstFall),
    frostFree,
    years,
    zone: avgMin === null ? null : zoneFromMinF(avgMin),
    source: 'history',
  };
}

/**
 * Frost windows from two dates the gardener typed in (their average last and first frost).
 * Without records we assume the usual spread of about two weeks either side.
 */
export function frostFromManual(lastSpring: ISO, firstFall: ISO, zone: string | null = null): FrostInfo {
  const around = (iso: ISO): FrostWindow => {
    const median = dayOfYear(iso);
    return { early: Math.max(1, median - 14), median, late: Math.min(365, median + 14) };
  };
  return { lastSpring: around(lastSpring), firstFall: around(firstFall), frostFree: false, years: 0, zone, source: 'manual' };
}

/** Days between the average last spring frost and the average first fall frost. */
export function frostFreeDays(frost: FrostInfo): number | null {
  if (frost.frostFree) return 365;
  if (!frost.lastSpring || !frost.firstFall) return null;
  return frost.firstFall.median - frost.lastSpring.median;
}

/** The date tender crops schedule from: frost risk has dropped to about 10%. */
export function safeDate(frost: FrostInfo, year: number): ISO | null {
  return frost.lastSpring ? fromDayOfYear(year, frost.lastSpring.late) : null;
}

/** 'Last frost usually between Apr 2 and Apr 24.' */
export function describeFrost(frost: FrostInfo, year: number): string {
  if (frost.frostFree) return 'Frost is rare here, so the calendar follows heat instead of frost.';
  const parts: string[] = [];
  if (frost.lastSpring) {
    parts.push(
      `Last spring frost usually between ${fmtDate(fromDayOfYear(year, frost.lastSpring.early))} and ${fmtDate(fromDayOfYear(year, frost.lastSpring.late))}.`,
    );
  }
  if (frost.firstFall) {
    parts.push(
      `First fall frost usually between ${fmtDate(fromDayOfYear(year, frost.firstFall.early))} and ${fmtDate(fromDayOfYear(year, frost.firstFall.late))}.`,
    );
  }
  return parts.join(' ') || 'Not enough records to work out frost dates here. You can enter them by hand.';
}

