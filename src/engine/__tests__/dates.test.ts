import { describe, expect, it } from 'vitest';
import { addDays, dayOfYear, diffDays, fmtDate, fmtRange, fromDayOfYear, inRange, isISO, todayISO, toDays, fromDays } from '../dates';

describe('date math', () => {
  it('adds days across a month end', () => expect(addDays('2027-01-30', 3)).toBe('2027-02-02'));
  it('adds days across a year end', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
  it('subtracts days', () => expect(addDays('2027-03-01', -1)).toBe('2027-02-28'));
  it('knows 2028 is a leap year', () => expect(addDays('2028-02-28', 1)).toBe('2028-02-29'));
  it('measures the gap between two dates', () => expect(diffDays('2027-10-15', '2027-04-20')).toBe(178));
  it('gives a negative gap when the first date is earlier', () => expect(diffDays('2027-04-20', '2027-04-27')).toBe(-7));
  it('round-trips through day numbers', () => expect(fromDays(toDays('2027-07-04'))).toBe('2027-07-04'));
  it('counts January 1 as day 1', () => expect(dayOfYear('2027-01-01')).toBe(1));
  it('counts April 20 as day 110 in a normal year', () => expect(dayOfYear('2027-04-20')).toBe(110));
  it('counts April 20 as day 111 in a leap year', () => expect(dayOfYear('2028-04-20')).toBe(111));
  it('turns a day of year back into a date', () => expect(fromDayOfYear(2027, 288)).toBe('2027-10-15'));
  it('accepts real dates and rejects impossible ones', () => {
    expect(isISO('2027-02-28')).toBe(true);
    expect(isISO('2027-02-30')).toBe(false);
    expect(isISO('4/20/2027')).toBe(false);
    expect(isISO(null)).toBe(false);
  });
  it("uses the device's local date for today", () => expect(todayISO(new Date(2027, 3, 5, 23, 59))).toBe('2027-04-05'));
  it('formats dates for people', () => {
    expect(fmtDate('2027-04-05')).toBe('Apr 5');
    expect(fmtDate('2027-04-05', true)).toBe('Apr 5, 2027');
  });
  it('formats ranges compactly', () => {
    expect(fmtRange('2027-04-05', '2027-04-19')).toBe('Apr 5–19');
    expect(fmtRange('2027-04-25', '2027-05-09')).toBe('Apr 25 – May 9');
  });
  it('treats range ends as inclusive', () => {
    expect(inRange('2027-04-05', '2027-04-05', '2027-04-19')).toBe(true);
    expect(inRange('2027-04-20', '2027-04-05', '2027-04-19')).toBe(false);
  });
});
