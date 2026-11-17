import { getPlant } from './plants';
import type { Harvest } from './types';

const TO_LB: Record<Exclude<Harvest['unit'], 'count'>, number> = { lb: 1, oz: 1 / 16, kg: 2.20462, g: 0.00220462 };

export interface HarvestTotal {
  plantId: string;
  /** All weighed harvests, converted to pounds. */
  lb: number;
  /** Harvests logged as a count (e.g. 12 tomatoes). */
  count: number;
  entries: number;
}

/** Totals per plant, biggest harvest first. Optionally only one year. */
export function harvestTotals(harvests: Harvest[], year?: number): HarvestTotal[] {
  const map = new Map<string, HarvestTotal>();
  for (const h of harvests) {
    if (year !== undefined && Number(h.date.slice(0, 4)) !== year) continue;
    if (!(h.amount > 0)) continue;
    const t = map.get(h.plantId) ?? { plantId: h.plantId, lb: 0, count: 0, entries: 0 };
    if (h.unit === 'count') t.count += h.amount;
    else t.lb += h.amount * TO_LB[h.unit];
    t.entries++;
    map.set(h.plantId, t);
  }
  return [...map.values()].sort((a, b) => b.lb - a.lb || b.count - a.count);
}

/** '3.5 lb', '6 oz', '12 picked', or '2 lb + 12 picked'. */
export function fmtTotal(t: Pick<HarvestTotal, 'lb' | 'count'>): string {
  const parts: string[] = [];
  if (t.lb > 0) parts.push(t.lb >= 1 ? `${Number(t.lb.toFixed(1))} lb` : `${Math.round(t.lb * 16)} oz`);
  if (t.count > 0) parts.push(`${t.count} picked`);
  return parts.join(' + ') || 'nothing yet';
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The harvest log as CSV, oldest first, for the data export. */
export function harvestsCsv(harvests: Harvest[]): string {
  const rows = [...harvests]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((h) => [h.date, getPlant(h.plantId)?.name ?? h.plantId, h.amount, h.unit, h.note ?? ''].map(csvCell).join(','));
  return ['date,plant,amount,unit,note', ...rows].join('\n') + '\n';
}
