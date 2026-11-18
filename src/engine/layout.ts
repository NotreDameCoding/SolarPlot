import { effectiveDtm } from './calendar';
import { frostFreeDays, type FrostInfo } from './frost';
import { getPlant, plural } from './plants';
import type { Garden, Plant, Planting, Sun } from './types';

export const MAX_COLS = 12;
export const MAX_ROWS = 8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectOf(planting: Planting): Rect {
  const [w, h] = getPlant(planting.plantId)?.footprint ?? [1, 1];
  return { x: planting.x, y: planting.y, w, h };
}

export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Sharing an edge (not just a corner), without overlapping. */
export function touches(a: Rect, b: Rect): boolean {
  if (overlaps(a, b)) return false;
  const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
  const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
  const xTouch = a.x + a.w === b.x || b.x + b.w === a.x;
  const yTouch = a.y + a.h === b.y || b.y + b.h === a.y;
  return (xTouch && yOverlap) || (yTouch && xOverlap);
}

export const inBounds = (g: Garden, r: Rect): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= g.cols && r.y + r.h <= g.rows;

/** Keep a footprint inside the bed by sliding it back in. */
export function clampToBed(g: Garden, r: Rect): { x: number; y: number } {
  return { x: Math.max(0, Math.min(g.cols - r.w, r.x)), y: Math.max(0, Math.min(g.rows - r.h, r.y)) };
}

/** Is this spot inside the bed and free of other plants? */
export function fits(g: Garden, plantings: Planting[], plantId: string, x: number, y: number, ignoreId?: string): boolean {
  const plant = getPlant(plantId);
  if (!plant) return false;
  const r = { x, y, w: plant.footprint[0], h: plant.footprint[1] };
  if (!inBounds(g, r)) return false;
  return !plantings.some((p) => p.id !== ignoreId && overlaps(r, rectOf(p)));
}

export function plantingAt(plantings: Planting[], x: number, y: number): Planting | undefined {
  // Later plantings draw on top, so search from the end.
  for (let i = plantings.length - 1; i >= 0; i--) {
    if (overlaps(rectOf(plantings[i]), { x, y, w: 1, h: 1 })) return plantings[i];
  }
  return undefined;
}

const DENSITY_STEPS = [16, 9, 4, 2, 1];

/** Plants per tile. In-ground beds are one step sparser than raised beds. */
export function density(plant: Plant, type: Garden['type']): number {
  if (plant.footprint[0] * plant.footprint[1] > 1) return 1;
  if (type === 'raised') return plant.perSqFt;
  const i = DENSITY_STEPS.indexOf(plant.perSqFt);
  if (i === -1) return Math.max(1, Math.floor(plant.perSqFt / 2));
  return DENSITY_STEPS[Math.min(DENSITY_STEPS.length - 1, i + 1)];
}

/** How many plants a list of plantings adds up to, per plant id. */
export function plantCounts(g: Garden, plantings: Planting[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of plantings) {
    const plant = getPlant(p.plantId);
    if (plant) out.set(plant.id, (out.get(plant.id) ?? 0) + density(plant, g.type));
  }
  return out;
}

/* ---------- "Plan for me" ---------- */

export interface AutoPlan {
  plantings: Planting[];
  /** Plants that did not fit, with the reason. */
  unplaced: { plantId: string; reason: string }[];
  /** One sentence per placed plant explaining where it went. */
  reasons: Record<string, string>;
}

/** 0 = the edge facing the sun, 1 = the far edge. With no sunny side marked, the front counts as sunny. */
function distanceFromSun(g: Garden, x: number, y: number): number {
  const side = g.sunnySide ?? 'front';
  const col = g.cols > 1 ? x / (g.cols - 1) : 0;
  const row = g.rows > 1 ? y / (g.rows - 1) : 0;
  if (side === 'front') return 1 - row;
  if (side === 'back') return row;
  if (side === 'left') return col;
  return 1 - col;
}

const HEIGHT_TARGET = { tall: 1, medium: 0.5, low: 0 } as const;
/** First pass: share tiles evenly up to this many each, so no crop hogs a small bed. Leftovers are then shared out until the bed is full. */
const EVEN_SHARE = 6;
/** Dense crops (9+ per sq ft: carrots, radishes, beans, spinach) stop at 3 tiles, so a bed isn't 64 carrots and one tomato. */
const DENSE_CAP = 3;

/** Every tile, walked from the far side to the sunny side in a back-and-forth "snake", so neighbors in the list are neighbors in the bed. */
function snakeOrder(g: Garden): { x: number; y: number }[] {
  const side = g.sunnySide ?? 'front';
  const out: { x: number; y: number }[] = [];
  if (side === 'front' || side === 'back') {
    for (let i = 0; i < g.rows; i++) {
      const y = side === 'front' ? i : g.rows - 1 - i;
      for (let j = 0; j < g.cols; j++) out.push({ x: i % 2 === 0 ? j : g.cols - 1 - j, y });
    }
  } else {
    for (let i = 0; i < g.cols; i++) {
      const x = side === 'left' ? g.cols - 1 - i : i;
      for (let j = 0; j < g.rows; j++) out.push({ x, y: i % 2 === 0 ? j : g.rows - 1 - j });
    }
  }
  return out;
}

/**
 * Lay out the chosen plants. Rules, in order:
 * 1. Big plants (tomato, squash) get their true footprint first, tall ones on the far side from the sun.
 * 2. The remaining tiles are shared out between the single-tile plants, one tile at a time
 *    in the order they were chosen, until every tile is used. If only big plants were chosen,
 *    more of them are added while they fit.
 * 3. Each plant's tiles are laid as one strip, tallest plants farthest from the sun.
 * Companion planting is never used to place anything.
 */
export function autoPlan(g: Garden, plantIds: string[]): AutoPlan {
  const chosen = [...new Set(plantIds)].map(getPlant).filter((p): p is Plant => !!p);
  const area = (p: Plant) => p.footprint[0] * p.footprint[1];
  const plantings: Planting[] = [];
  const unplaced: AutoPlan['unplaced'] = [];
  const reasons: Record<string, string> = {};
  let n = 0;
  const add = (plant: Plant, x: number, y: number) => plantings.push({ id: `p${++n}`, plantId: plant.id, x, y });

  const order = new Map(snakeOrder(g).map((c, i) => [`${c.x},${c.y}`, i]));

  // 1. Big footprints, largest first.
  const big = chosen.filter((p) => area(p) > 1).sort((a, b) => area(b) - area(a));
  const bestBigSpot = (plant: Plant) => {
    const [w, h] = plant.footprint;
    let best: { x: number; y: number; score: number } | null = null;
    for (let y = 0; y + h <= g.rows; y++) {
      for (let x = 0; x + w <= g.cols; x++) {
        if (!fits(g, plantings, plant.id, x, y)) continue;
        const d = distanceFromSun(g, x + (w - 1) / 2, y + (h - 1) / 2);
        const score = Math.abs(d - HEIGHT_TARGET[plant.height]) - (order.get(`${x},${y}`) ?? 0) * 0.0001;
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    return best;
  };
  for (const plant of big) {
    const [w, h] = plant.footprint;
    let best: { x: number; y: number; score: number } | null = null;
    for (let y = 0; y + h <= g.rows; y++) {
      for (let x = 0; x + w <= g.cols; x++) {
        if (!fits(g, plantings, plant.id, x, y)) continue;
        const d = distanceFromSun(g, x + (w - 1) / 2, y + (h - 1) / 2);
        const score = Math.abs(d - HEIGHT_TARGET[plant.height]) - (order.get(`${x},${y}`) ?? 0) * 0.0001; // tie-break: far end of the first strip
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    if (!best) {
      unplaced.push({ plantId: plant.id, reason: `No room left for ${plant.name.toLowerCase()}: it needs ${w} × ${h} ft to itself.` });
      continue;
    }
    add(plant, best.x, best.y);
    reasons[plant.id] = `${plural(plant)} get their full ${w} × ${h} ft, so they were placed first.`;
  }

  // Only big plants chosen: keep adding them while they fit, so the bed is not left bare.
  const small = chosen.filter((p) => area(p) === 1);
  if (small.length === 0) {
    let added = true;
    while (added) {
      added = false;
      for (const plant of big) {
        if (!plantings.some((p) => p.plantId === plant.id)) continue;
        const spot = bestBigSpot(plant);
        if (spot) { add(plant, spot.x, spot.y); added = true; }
      }
    }
  }

  // 2. Share the free tiles between the single-tile plants until the bed is full.
  const free = snakeOrder(g).filter((c) => !plantingAt(plantings, c.x, c.y));
  const quota = new Map(small.map((p) => [p.id, 0]));
  // Caps keep the mix balanced, unless every chosen crop is of that kind (then they must fill the bed).
  const allDense = small.every((p) => p.perSqFt >= 9);
  const allTall = small.every((p) => p.height === 'tall');
  const edge = g.sunnySide === 'left' || g.sunnySide === 'right' ? g.rows : g.cols;
  const capOf = (p: Plant) =>
    p.height === 'tall' && !allTall ? Math.max(1, Math.floor(edge / 2)) : p.perSqFt >= 9 && !allDense ? DENSE_CAP : Infinity;
  let left = free.length;
  let progress = true;
  for (const cap of [EVEN_SHARE, Infinity]) {
    progress = true;
    while (left > 0 && progress) {
      progress = false;
      for (const plant of small) {
        if (left === 0 || quota.get(plant.id)! >= Math.min(cap, capOf(plant))) continue;
        quota.set(plant.id, quota.get(plant.id)! + 1);
        left--;
        progress = true;
      }
    }
  }

  // 3. Lay each plant's tiles as one strip, tallest first (farthest from the sun).
  const sunMarked = g.sunnySide !== null;
  const byHeight = [...small].sort((a, b) => HEIGHT_TARGET[b.height] - HEIGHT_TARGET[a.height] || small.indexOf(a) - small.indexOf(b));
  let next = 0;
  for (const plant of byHeight) {
    const count = quota.get(plant.id)!;
    if (count === 0) {
      unplaced.push({ plantId: plant.id, reason: `No room left for ${plant.name.toLowerCase()}.` });
      continue;
    }
    for (let i = 0; i < count; i++) add(plant, free[next + i].x, free[next + i].y);
    next += count;
    const names = plural(plant);
    if (plant.height === 'tall') reasons[plant.id] = sunMarked
      ? `${names} are tall, so they sit on the far side from the sun where they will not shade shorter plants.`
      : `${names} are tall, so they sit along the back. Mark the bed's sunny side to check shading.`;
    else if (plant.height === 'low') reasons[plant.id] = `${names} stay low, so they sit toward the sunny edge, clear of taller plants.`;
    else reasons[plant.id] = `${names} are medium height, so they sit in the middle rows.`;
  }

  return { plantings, unplaced, reasons };
}

/** A balanced starter set for "plan for me", matched to the bed's sun and size. */
export function starterSet(goal: 'food' | 'flowers' | 'pollinators' | 'mix', sun: Sun, tiles: number): string[] {
  const sets: Record<typeof goal, string[]> = {
    food: ['tomato', 'pepper', 'bushbean', 'lettuce', 'carrot', 'radish', 'basil', 'marigold', 'kale', 'spinach'],
    flowers: ['sunflower', 'zinnia', 'cosmos', 'marigold', 'calendula', 'nasturtium', 'alyssum'],
    pollinators: ['sunflower', 'zinnia', 'borage', 'alyssum', 'calendula', 'thyme', 'cosmos', 'nasturtium'],
    mix: ['tomato', 'lettuce', 'carrot', 'bushbean', 'basil', 'marigold', 'zinnia', 'sunflower', 'radish'],
  };
  const shade = ['lettuce', 'spinach', 'kale', 'chard', 'radish', 'pea', 'parsley', 'calendula', 'alyssum', 'chives'];
  let ids = sets[goal].filter((id) => sun === 'full' || getPlant(id)?.sun === 'part');
  if (sun !== 'full') ids = [...new Set([...ids, ...shade])];
  // Small beds: skip plants that would eat a quarter of the bed, and keep the list short.
  ids = ids.filter((id) => {
    const [w, h] = getPlant(id)!.footprint;
    return w * h <= tiles / 4 && w * h <= tiles;
  });
  const limit = tiles <= 8 ? 4 : tiles <= 16 ? 6 : tiles <= 40 ? 8 : 10;
  return ids.slice(0, limit);
}

/* ---------- Hints and warnings ---------- */

export type IssueLevel = 'hint' | 'caution' | 'problem';

export interface Issue {
  level: IssueLevel;
  /** The plantings this is about (outlined in the editor). */
  plantingIds: string[];
  text: string;
  fix?: string;
}

const SUN_HOURS: Record<Sun, string> = { full: '6+ hours', part: '3 to 6 hours', shade: 'under 3 hours' };

/**
 * Everything the editor should tell the gardener about this layout.
 * These are advice only: nothing here ever blocks an edit.
 */
export function checkGarden(g: Garden, plantings: Planting[], frost?: FrostInfo | null): Issue[] {
  const issues: Issue[] = [];
  const known = plantings.filter((p) => getPlant(p.plantId));
  const rects = new Map(known.map((p) => [p.id, rectOf(p)]));
  const plantOf = (p: Planting) => getPlant(p.plantId)!;

  // Footprint: outside the bed, or crowding a neighbor.
  for (const p of known) {
    if (!inBounds(g, rects.get(p.id)!)) {
      const [w, h] = plantOf(p).footprint;
      issues.push({ level: 'problem', plantingIds: [p.id], text: `${plantOf(p).name} needs ${w} × ${h} ft and hangs over the edge of the bed.`, fix: 'Move it inward or choose a smaller plant.' });
    }
  }
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      if (overlaps(rects.get(known[i].id)!, rects.get(known[j].id)!)) {
        issues.push({ level: 'caution', plantingIds: [known[i].id, known[j].id], text: `Too close: ${plantOf(known[i]).name.toLowerCase()} and ${plantOf(known[j]).name.toLowerCase()} will crowd each other.`, fix: 'Move one of them to a free tile.' });
      }
    }
  }

  // Per plant kind: sun, season length, spreading, pollination.
  const byPlant = new Map<string, Planting[]>();
  for (const p of known) byPlant.set(p.plantId, [...(byPlant.get(p.plantId) ?? []), p]);
  const season = frost ? frostFreeDays(frost) : null;

  for (const [plantId, list] of byPlant) {
    const plant = getPlant(plantId)!;
    const ids = list.map((p) => p.id);
    const names = plural(plant);

    if (plant.sun === 'full' && g.sun === 'shade') {
      issues.push({ level: 'problem', plantingIds: ids, text: `${names} need ${SUN_HOURS.full} of sun; this garden gets ${SUN_HOURS.shade}.`, fix: 'Try leafy greens or herbs like parsley and chives instead.' });
    } else if (plant.sun === 'full' && g.sun === 'part') {
      issues.push({ level: 'caution', plantingIds: ids, text: `${names} do best with ${SUN_HOURS.full} of sun; this garden gets ${SUN_HOURS.part}. Expect a smaller harvest.` });
    } else if (plant.sun === 'part' && g.sun === 'shade') {
      issues.push({ level: 'caution', plantingIds: ids, text: `${names} want at least 3 hours of sun; this garden gets less. Growth will be slow.` });
    }

    if (season !== null && plant.minNightF) {
      const need = effectiveDtm(plant, plant.start[0]) + 21;
      if (season < need) {
        issues.push({ level: 'problem', plantingIds: ids, text: `Your frost-free season is about ${season} days; ${names.toLowerCase()} need about ${need} from planting to a real harvest.`, fix: 'Start with seedlings, pick a fast variety, or choose a cool-season crop.' });
      }
    }

    if (plant.spreads) {
      issues.push({ level: 'caution', plantingIds: ids, text: `${plant.name} spreads by runners and can take over the bed.`, fix: 'Grow it in a pot instead.' });
    }
    if (plant.id === 'corn' && list.length < 4) {
      issues.push({ level: 'hint', plantingIds: ids, text: 'Corn is wind-pollinated and fills its ears best in a block of four or more tiles.' });
    }
  }

  // Shading: a tall plant with a shorter sun-lover directly on its shady side.
  {
    const assumed = g.sunnySide === null;
    const [dx, dy] = { front: [0, -1], back: [0, 1], left: [1, 0], right: [-1, 0] }[g.sunnySide ?? 'front'];
    const seen = new Set<string>();
    for (const tall of known) {
      if (plantOf(tall).height !== 'tall') continue;
      const t = rects.get(tall.id)!;
      const shadow = { x: t.x + dx * (dx > 0 ? t.w : 1), y: t.y + dy * (dy > 0 ? t.h : 1), w: dx ? 1 : t.w, h: dy ? 1 : t.h };
      for (const other of known) {
        const o = plantOf(other);
        if (other.id === tall.id || o.height === 'tall' || o.sun !== 'full') continue;
        if (!overlaps(shadow, rects.get(other.id)!)) continue;
        const key = `${tall.plantId}>${other.plantId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({ level: 'caution', plantingIds: [tall.id, other.id], text: `${plantOf(tall).name} will shade the ${o.name.toLowerCase()} behind it for part of the day.`, fix: assumed ? 'This assumes the front of the bed gets the sun. Mark the sunny side in Edit bed to check properly.' : 'Put tall plants on the side of the bed away from the sun.' });
      }
    }
  }

  // Companions: soft hints only, once per pair of plant kinds.
  const pairSeen = new Set<string>();
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const a = plantOf(known[i]);
      const b = plantOf(known[j]);
      if (a.id === b.id || !touches(rects.get(known[i].id)!, rects.get(known[j].id)!)) continue;
      const key = [a.id, b.id].sort().join('+');
      if (pairSeen.has(key)) continue;
      const friends = a.friends.includes(b.id) || b.friends.includes(a.id);
      const foes = a.foes.includes(b.id) || b.foes.includes(a.id);
      if (!friends && !foes) continue;
      pairSeen.add(key);
      issues.push(foes
        ? { level: 'hint', plantingIds: [known[i].id, known[j].id], text: `Some gardeners keep ${plural(a).toLowerCase()} and ${plural(b).toLowerCase()} apart. It is tradition more than science, so do not worry much.` }
        : { level: 'hint', plantingIds: [known[i].id, known[j].id], text: `${plural(a)} and ${plural(b).toLowerCase()} are often grown together.` });
    }
  }

  const rank = { problem: 0, caution: 1, hint: 2 };
  return issues.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** The most serious issue level for each planting, for outlining tiles. */
export function worstLevels(issues: Issue[]): Map<string, IssueLevel> {
  const rank = { hint: 0, caution: 1, problem: 2 };
  const out = new Map<string, IssueLevel>();
  for (const issue of issues) {
    for (const id of issue.plantingIds) {
      const cur = out.get(id);
      if (!cur || rank[issue.level] > rank[cur]) out.set(id, issue.level);
    }
  }
  return out;
}

/**
 * Make plantings fit a resized bed. Plants still inside stay put. A plant cut off by the new edge
 * moves to the nearest free spot that fits (never on top of another plant); if there is none, it is
 * left out (Undo brings it back).
 */
export function fitToBed(g: Garden, plantings: Planting[]): Planting[] {
  const kept: Planting[] = [];
  const homeless: Planting[] = [];
  for (const p of plantings) {
    const r = rectOf(p);
    if (r.w > g.cols || r.h > g.rows) continue;
    if (inBounds(g, r) && !kept.some((k) => overlaps(r, rectOf(k)))) kept.push(p);
    else homeless.push(p);
  }
  for (const p of homeless) {
    const r = rectOf(p);
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y + r.h <= g.rows; y++) {
      for (let x = 0; x + r.w <= g.cols; x++) {
        if (kept.some((k) => overlaps({ x, y, w: r.w, h: r.h }, rectOf(k)))) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (best) kept.push({ ...p, x: best.x, y: best.y });
  }
  // Keep the original order so the planner draws them the same way.
  const order = new Map(plantings.map((p, i) => [p.id, i]));
  return kept.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
