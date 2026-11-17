import { effectiveDtm } from './calendar';
import { addDays, diffDays } from './dates';
import type { ISO, Plant, Planting } from './types';

export type Phase = 'planned' | 'seed' | 'sprout' | 'young' | 'mature' | 'harvest' | 'done';

export interface Growth {
  phase: Phase;
  /** 0 = just planted, 1 = full size. */
  fraction: number;
  daysIn: number;
  harvestFrom: ISO | null;
  harvestTo: ISO | null;
}

export const PHASE_LABEL: Record<Phase, string> = {
  planned: 'Not planted yet',
  seed: 'Just planted',
  sprout: 'Sprouting',
  young: 'Growing',
  mature: 'Nearly ready',
  harvest: 'Ready to harvest',
  done: 'Finished',
};

/** Where a planting is in its life today, from its planting date and days to maturity. */
export function growth(plant: Plant, planting: Planting, today: ISO): Growth {
  if (!planting.plantedOn || planting.plantedOn > today) {
    return { phase: 'planned', fraction: 0, daysIn: 0, harvestFrom: null, harvestTo: null };
  }
  const method = planting.method ?? plant.start[0];
  const dtm = effectiveDtm(plant, method);
  const daysIn = diffDays(today, planting.plantedOn);
  // Seedlings go in already partly grown.
  const head = method === 'transplant' ? 0.25 : 0;
  const fraction = Math.min(1, head + (1 - head) * (daysIn / dtm));
  const harvestFrom = addDays(planting.plantedOn, dtm);
  const harvestTo = addDays(harvestFrom, plant.harvestDays);

  let phase: Phase;
  if (today > harvestTo && !plant.perennial) phase = 'done';
  else if (today >= harvestFrom) phase = 'harvest';
  else if (fraction < 0.08) phase = 'seed';
  else if (fraction < 0.3) phase = 'sprout';
  else if (fraction < 0.7) phase = 'young';
  else phase = 'mature';
  return { phase, fraction, daysIn, harvestFrom, harvestTo };
}
