import type { ISO } from './types';

const MS_PER_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isISO(value: unknown): value is ISO {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromDays(toDays(value)) === value;
}

/** Days since 1970-01-01. All date math goes through this so timezones never matter. */
export function toDays(iso: ISO): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDays(days: number): ISO {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10);
}

export const addDays = (iso: ISO, n: number): ISO => fromDays(toDays(iso) + n);
/** a minus b, in days. */
export const diffDays = (a: ISO, b: ISO): number => toDays(a) - toDays(b);
export const yearOf = (iso: ISO): number => Number(iso.slice(0, 4));

/** 1 = January 1. */
export function dayOfYear(iso: ISO): number {
  return toDays(iso) - toDays(`${iso.slice(0, 4)}-01-01`) + 1;
}

export function fromDayOfYear(year: number, doy: number): ISO {
  return addDays(`${year}-01-01`, doy - 1);
}

/** Today's date where the user is (uses the device clock, not UTC). */
export function todayISO(now: Date = new Date()): ISO {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 'Apr 12', or 'Apr 12, 2027' with the year. */
export function fmtDate(iso: ISO, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}

export function fmtRange(start: ISO, end: ISO): string {
  if (start === end) return fmtDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${fmtDate(start)}–${Number(end.slice(8))}` : `${fmtDate(start)} – ${fmtDate(end)}`;
}

export const inRange = (day: ISO, start: ISO, end: ISO): boolean => day >= start && day <= end;
