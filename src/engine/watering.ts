import { getPlant } from './plants';
import type { Planting } from './types';

export interface WateringNudge {
  water: boolean;
  /** Inches to add, rounded up to the nearest quarter inch. 0 when no watering is needed. */
  amountIn: number;
  text: string;
}

/** The thirstiest plant sets the bed's weekly need. An empty bed uses the usual 1 inch. */
export function weeklyNeedIn(plantings: Planting[]): number {
  const needs = plantings.map((p) => getPlant(p.plantId)?.waterIn ?? 1);
  return needs.length ? Math.max(...needs) : 1;
}

const inches = (n: number) => `${Number(n.toFixed(2))} inch${n === 1 ? '' : 'es'}`;

/**
 * The weekly watering check: compare the last 7 days of rain, plus what is forecast
 * for the next 3 days, with what the bed needs.
 */
export function wateringNudge(pastRainIn: number, nextRainIn: number, needIn = 1): WateringNudge {
  const past = Math.max(0, pastRainIn);
  const next = Math.max(0, nextRainIn);
  if (past >= needIn) {
    return { water: false, amountIn: 0, text: `Rain covered it this week (${inches(past)} fell). No watering needed.` };
  }
  const deficit = needIn - past;
  if (next >= deficit) {
    return { water: false, amountIn: 0, text: `Only ${inches(past)} of rain this week, but about ${inches(next)} is forecast in the next 3 days. Hold off and check again.` };
  }
  const amountIn = Math.ceil((deficit - next) * 4) / 4;
  return { water: true, amountIn, text: `Water your beds: about ${inches(amountIn)} needed. Only ${inches(past)} of rain fell this week.` };
}
