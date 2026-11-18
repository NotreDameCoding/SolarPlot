import { addDays, diffDays, fmtDate, fromDayOfYear, inRange } from './dates';
import { zoneNumber, type FrostInfo } from './frost';
import type { ISO, Plant, StartMethod } from './types';

export interface DateWindow {
  start: ISO;
  end: ISO;
}

export interface PlantCalendar {
  plantId: string;
  season: 'spring' | 'fall' | 'overwinter' | 'cool-season';
  method: StartMethod;
  /** When to sow seeds indoors, if it starts as a seedling. */
  startIndoors?: DateWindow;
  /** The recommended window to sow or transplant outside. */
  plantOut: DateWindow;
  /** After this date there is not enough season left. */
  lastChance: ISO;
  harvest: DateWindow;
  /** One plain sentence explaining the dates. */
  why: string;
  notes: string[];
}

/**
 * Planting offsets by frost-tolerance class, in days.
 * Hardy and semi-hardy crops count from the average (50%) last frost.
 * Tender crops count from the date frost risk drops to about 10%.
 */
export const SPRING_OFFSETS = {
  hardy: { from: 'median', start: -42, end: -28 },
  semiHardy: { from: 'median', start: -14, end: 0 },
  tender: { from: 'late', start: 0, end: 21 },
  veryTender: { from: 'late', start: 14, end: 21 },
} as const;

/** How long after the average first fall frost each class keeps producing (hardy crops shrug off light frosts). */
const FROST_HARVEST_GRACE = { veryTender: 0, tender: 0, semiHardy: 14, hardy: 35 } as const;

/** Stop a spring harvest at the first fall frost, so tender crops never "harvest" into November. */
function capAtFrost(plant: Plant, frost: FrostInfo, year: number, harvest: DateWindow): DateWindow {
  if (!frost.firstFall || plant.perennial) return harvest;
  const cap = addDays(fromDayOfYear(year, frost.firstFall.median), FROST_HARVEST_GRACE[plant.frost]);
  const end = harvest.end < cap ? harvest.end : cap;
  return { start: harvest.start, end: end < harvest.start ? harvest.start : end };
}

/** Days from going outside to first harvest, for the chosen way of starting. */
export function effectiveDtm(plant: Plant, method: StartMethod): number {
  const indoorDays = (plant.indoorWeeks ?? 0) * 7;
  if (method === plant.dtmFrom) return plant.dtm;
  if (method === 'transplant') return Math.max(14, plant.dtm - indoorDays); // packet counts from seed
  return plant.dtm + indoorDays; // packet counts from transplant, but we are sowing seed
}

function indoorWindow(plant: Plant, method: StartMethod, plantOut: DateWindow): DateWindow | undefined {
  if (method !== 'transplant' || !plant.indoorWeeks) return undefined;
  const start = addDays(plantOut.start, -plant.indoorWeeks * 7);
  return { start, end: addDays(start, 14) };
}

function heatNotes(plant: Plant, frost: FrostInfo): string[] {
  const notes: string[] = [];
  const zone = zoneNumber(frost.zone);
  const hot = frost.frostFree || (zone !== null && zone >= 9);
  if (hot && plant.heatLimitF) notes.push(`Summer is the off-season for ${plant.name.toLowerCase()} here: it struggles once days pass ${plant.heatLimitF}°F. Fall and winter are its main season.`);
  if (hot && plant.heatStressF) notes.push(`Fruit set pauses while days stay above about ${plant.heatStressF}°F. Plant early, or again in late summer.`);
  if (plant.perennial && plant.frost === 'tender') notes.push('Only survives winter outdoors in mild climates (zone 7 and warmer).');
  return notes;
}

export function springCalendar(plant: Plant, frost: FrostInfo, year: number, method: StartMethod = plant.start[0]): PlantCalendar | null {
  if (plant.overwinter) return null;
  const dtm = effectiveDtm(plant, method);
  const name = plant.name;

  if (!frost.lastSpring) {
    if (!frost.frostFree) return null;
    // Frost-free climates: warm crops go in late winter, before the heat.
    if (plant.heatLimitF) return null; // cool crops are handled by fallCalendar
    const plantOut = { start: `${year}-02-15`, end: `${year}-04-15` };
    return {
      plantId: plant.id, season: 'spring', method, startIndoors: indoorWindow(plant, method, plantOut), plantOut,
      lastChance: plantOut.end,
      harvest: { start: addDays(plantOut.start, dtm), end: addDays(plantOut.end, dtm + plant.harvestDays) },
      why: `With no frost to wait for, ${name.toLowerCase()} goes in early so it can grow before the hottest months.`,
      notes: heatNotes(plant, frost),
    };
  }

  const rule = SPRING_OFFSETS[plant.frost];
  const anchor = fromDayOfYear(year, frost.lastSpring[rule.from]);
  const plantOut = { start: addDays(anchor, rule.start), end: addDays(anchor, rule.end) };
  const average = fmtDate(fromDayOfYear(year, frost.lastSpring.median));
  const safe = fmtDate(fromDayOfYear(year, frost.lastSpring.late));

  const why = {
    hardy: `${name} shrugs off frost, so it goes out 4 to 6 weeks before your average last frost (${average}).`,
    semiHardy: `${name} handles a light frost, so it goes out in the 2 weeks before your average last frost (${average}).`,
    tender: `${name} is killed by frost, so it waits until the risk of frost drops to about 1 in 10 (${safe}).`,
    veryTender: `${name} needs real warmth, so it waits 2 to 3 weeks after the risk of frost drops to about 1 in 10 (${safe}).`,
  }[plant.frost];

  // Warm crops must finish before fall frost; cool crops stop when it gets hot.
  let lastChance = addDays(plantOut.end, 21);
  if (plant.minNightF && frost.firstFall) {
    const latest = addDays(fromDayOfYear(year, frost.firstFall.median), -(dtm + 14));
    if (latest > lastChance) lastChance = latest;
  }

  const notes = heatNotes(plant, frost);
  if (plant.minSoilF && plant.minNightF) notes.push(`Also wait for soil near ${plant.minSoilF}°F and nights above ${plant.minNightF}°F.`);

  return {
    plantId: plant.id, season: 'spring', method, startIndoors: indoorWindow(plant, method, plantOut), plantOut, lastChance,
    harvest: capAtFrost(plant, frost, year, { start: addDays(plantOut.start, dtm), end: addDays(plantOut.end, dtm + plant.harvestDays) }),
    why, notes,
  };
}

export function fallCalendar(plant: Plant, frost: FrostInfo, year: number, method: StartMethod = plant.start[0]): PlantCalendar | null {
  if (!plant.fall) return null;
  const dtm = effectiveDtm(plant, method);
  const name = plant.name;

  if (!frost.firstFall) {
    if (!frost.frostFree) return null;
    // Frost-free climates: cool crops grow through the mild winter.
    const plantOut = { start: `${year}-10-01`, end: `${year + 1}-01-31` };
    return {
      plantId: plant.id, season: 'cool-season', method, startIndoors: indoorWindow(plant, method, plantOut), plantOut,
      lastChance: plantOut.end,
      harvest: { start: addDays(plantOut.start, dtm), end: addDays(plantOut.end, dtm + plant.harvestDays) },
      why: `${name} likes cool weather, so here it grows through the mild winter instead of summer.`,
      notes: heatNotes(plant, frost),
    };
  }

  const firstFrost = fromDayOfYear(year, frost.firstFall.median);

  if (plant.overwinter) {
    const plantOut = { start: addDays(firstFrost, -14), end: addDays(firstFrost, 21) };
    const harvestStart = addDays(plantOut.start, plant.dtm);
    return {
      plantId: plant.id, season: 'overwinter', method, plantOut, lastChance: addDays(plantOut.end, 14),
      harvest: { start: harvestStart, end: addDays(harvestStart, plant.harvestDays) },
      why: `${name} is planted around your first fall frost (${fmtDate(firstFrost)}), roots in before the ground freezes, and is harvested next summer.`,
      notes: [],
    };
  }

  // Count back from first frost: growing time plus two slow weeks as the days shorten.
  // Hardy crops keep growing through light frosts, so they do not need the buffer.
  const buffer = plant.frost === 'hardy' ? 0 : 14;
  const sowBy = addDays(firstFrost, -(dtm + buffer));
  const plantOut = { start: addDays(sowBy, -21), end: sowBy };
  return {
    plantId: plant.id, season: 'fall', method, startIndoors: indoorWindow(plant, method, plantOut), plantOut,
    lastChance: addDays(sowBy, 7),
    harvest: { start: addDays(plantOut.start, dtm + 14), end: addDays(firstFrost, plant.frost === 'hardy' ? 28 : 7) },
    why: `Fall crops are counted back from your first frost (${fmtDate(firstFrost)}): ${dtm} days to grow, plus extra time because plants slow down as days shorten.`,
    notes: heatNotes(plant, frost),
  };
}

/** Every planting window for one plant in a given year, earliest first. */
export function calendarsFor(plant: Plant, frost: FrostInfo, year: number): PlantCalendar[] {
  const out = [springCalendar(plant, frost, year), fallCalendar(plant, frost, year)].filter((c): c is PlantCalendar => c !== null);
  return out.sort((a, b) => (a.plantOut.start < b.plantOut.start ? -1 : 1));
}

export interface Conditions {
  /** Forecast overnight lows for the next week, °F. */
  nightLowsF?: number[];
  /** Soil temperature near the surface, °F, if we have it. */
  soilF?: number | null;
}

/** The warm-crop gate: tender crops wait for warm soil and warm nights, whatever the calendar says. */
export function warmGate(plant: Plant, cond: Conditions): { ok: boolean; reason: string } {
  if (!plant.minNightF) return { ok: true, reason: '' };
  const lows = cond.nightLowsF ?? [];
  if (lows.length) {
    const coldest = Math.min(...lows);
    if (coldest < plant.minNightF) {
      return { ok: false, reason: `Nights are still dipping to ${Math.round(coldest)}°F. ${plant.name} wants nights above ${plant.minNightF}°F.` };
    }
  }
  if (plant.minSoilF && cond.soilF != null && cond.soilF < plant.minSoilF) {
    return { ok: false, reason: `Soil is about ${Math.round(cond.soilF)}°F. ${plant.name} wants soil near ${plant.minSoilF}°F.` };
  }
  return { ok: true, reason: '' };
}

export type StatusState = 'indoors' | 'now' | 'wait-warm' | 'late' | 'soon' | 'early' | 'past';

export interface PlantingStatus {
  state: StatusState;
  text: string;
}

/** What to tell the gardener about one planting window today. */
export function plantingStatus(plant: Plant, cal: PlantCalendar, today: ISO, cond: Conditions = {}): PlantingStatus {
  const verb = cal.method === 'transplant' ? 'Plant out' : 'Sow';
  if (cal.startIndoors && inRange(today, cal.startIndoors.start, cal.startIndoors.end)) {
    return { state: 'indoors', text: 'Start seeds indoors now.' };
  }
  if (today < cal.plantOut.start) {
    const days = diffDays(cal.plantOut.start, today);
    if (cal.startIndoors && today > cal.startIndoors.end) return { state: 'soon', text: `Seedlings go outside in ${days} days.` };
    return days <= 14
      ? { state: 'soon', text: `${verb} in ${days} day${days === 1 ? '' : 's'}.` }
      : { state: 'early', text: `Too early. ${verb} from ${fmtDate(cal.plantOut.start)}.` };
  }
  if (today <= cal.lastChance) {
    const gate = warmGate(plant, cond);
    if (!gate.ok) return { state: 'wait-warm', text: `Wait for warmth. ${gate.reason}` };
    return today <= cal.plantOut.end
      ? { state: 'now', text: `${verb} now.` }
      : { state: 'late', text: `A little late, but still fine. ${verb} by ${fmtDate(cal.lastChance)}.` };
  }
  return { state: 'past', text: 'This window has passed.' };
}
