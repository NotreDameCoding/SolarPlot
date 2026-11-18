import { describe, expect, it } from 'vitest';
import { autoPlan, clampToBed, density, fits, fitToBed, inBounds, overlaps, plantCounts, plantingAt, rectOf, starterSet, touches } from '../layout';
import { getPlant, PLANTS, plantOrThrow } from '../plants';
import { at, bed } from './helpers';

const noOverlaps = (plantings: ReturnType<typeof autoPlan>['plantings']) =>
  plantings.every((a, i) => plantings.slice(i + 1).every((b) => !overlaps(rectOf(a), rectOf(b))));

describe('footprints', () => {
  it('gives a tomato its caged 2 × 2 ft', () => expect(rectOf(at('tomato', 1, 1))).toEqual({ x: 1, y: 1, w: 2, h: 2 }));
  it('gives zucchini 3 × 3 ft', () => expect(plantOrThrow('zucchini').footprint).toEqual([3, 3]));
  it('gives lettuce a single tile', () => expect(rectOf(at('lettuce', 0, 0))).toEqual({ x: 0, y: 0, w: 1, h: 1 }));
  it('detects overlapping footprints', () => {
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 1, h: 1 })).toBe(false);
  });
  it('counts edge neighbors as touching but not corners', () => {
    expect(touches({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 })).toBe(true);
    expect(touches({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(false);
    expect(touches({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(false);
  });
  it('knows when a footprint leaves the bed', () => {
    expect(inBounds(bed(4, 4), { x: 3, y: 3, w: 1, h: 1 })).toBe(true);
    expect(inBounds(bed(4, 4), { x: 3, y: 3, w: 2, h: 2 })).toBe(false);
    expect(inBounds(bed(4, 4), { x: -1, y: 0, w: 1, h: 1 })).toBe(false);
  });
  it('slides a footprint back inside the bed', () => {
    expect(clampToBed(bed(4, 4), { x: 3, y: 5, w: 2, h: 2 })).toEqual({ x: 2, y: 2 });
  });
});

describe('placing plants', () => {
  const g = bed(4, 4);
  it('fits a plant on an empty tile', () => expect(fits(g, [], 'carrot', 0, 0)).toBe(true));
  it('refuses a taken tile', () => expect(fits(g, [at('carrot', 0, 0)], 'radish', 0, 0)).toBe(false));
  it('refuses a tile under a big plant', () => expect(fits(g, [at('tomato', 0, 0)], 'radish', 1, 1)).toBe(false));
  it('refuses a big plant that would hang over the edge', () => expect(fits(g, [], 'tomato', 3, 3)).toBe(false));
  it('refuses a plant bigger than the bed', () => expect(fits(bed(2, 2), [], 'zucchini', 0, 0)).toBe(false));
  it('lets a plant move within its own footprint', () => {
    const t = at('tomato', 0, 0);
    expect(fits(g, [t], 'tomato', 1, 0, t.id)).toBe(true);
  });
  it('refuses unknown plants', () => expect(fits(g, [], 'triffid', 0, 0)).toBe(false));
  it('finds the plant covering a tile', () => {
    const t = at('tomato', 1, 1);
    expect(plantingAt([t], 2, 2)?.id).toBe(t.id);
    expect(plantingAt([t], 0, 0)).toBeUndefined();
  });
});

describe('spacing', () => {
  it('uses square-foot densities in raised beds', () => {
    expect(density(plantOrThrow('carrot'), 'raised')).toBe(16);
    expect(density(plantOrThrow('lettuce'), 'raised')).toBe(4);
  });
  it('goes one step sparser in the ground', () => {
    expect(density(plantOrThrow('carrot'), 'inground')).toBe(9);
    expect(density(plantOrThrow('bushbean'), 'inground')).toBe(4);
    expect(density(plantOrThrow('lettuce'), 'inground')).toBe(2);
    expect(density(plantOrThrow('pepper'), 'inground')).toBe(1);
  });
  it('halves densities that are not on the usual steps', () => expect(density(plantOrThrow('pea'), 'inground')).toBe(4));
  it('is never sparser than one plant per tile, or denser in the ground', () => {
    for (const p of PLANTS) {
      expect(density(p, 'inground')).toBeGreaterThanOrEqual(1);
      expect(density(p, 'inground')).toBeLessThanOrEqual(density(p, 'raised'));
    }
  });
  it('counts one plant for a big footprint', () => expect(density(plantOrThrow('tomato'), 'raised')).toBe(1));
  it('adds up plants across tiles', () => {
    const counts = plantCounts(bed(4, 4), [at('carrot', 0, 0), at('carrot', 1, 0), at('tomato', 2, 2)]);
    expect(counts.get('carrot')).toBe(32);
    expect(counts.get('tomato')).toBe(1);
  });
});

describe('plan for me', () => {
  const food = ['tomato', 'pepper', 'bushbean', 'lettuce', 'carrot', 'basil', 'marigold'];
  const plan = autoPlan(bed(4, 8), food);
  const rowsOf = (id: string, p = plan) => p.plantings.filter((x) => x.plantId === id).map((x) => x.y);

  it('places every chosen plant when there is room', () => {
    expect(plan.unplaced).toEqual([]);
    expect(new Set(plan.plantings.map((p) => p.plantId)).size).toBe(food.length);
  });
  it('never overlaps two plants', () => expect(noOverlaps(plan.plantings)).toBe(true));
  it('keeps everything inside the bed', () => {
    expect(plan.plantings.every((p) => inBounds(bed(4, 8), rectOf(p)))).toBe(true);
  });
  it('fills the bed', () => {
    const tiles = plan.plantings.reduce((n, p) => n + rectOf(p).w * rectOf(p).h, 0);
    expect(tiles).toBe(32);
  });
  it('gives each planting a unique id', () => {
    expect(new Set(plan.plantings.map((p) => p.id)).size).toBe(plan.plantings.length);
  });
  it('puts the tall tomato at the back when the sun is at the front', () => {
    expect(rowsOf('tomato')).toEqual([0]);
  });
  it('puts the tall tomato at the front when the sun is at the back', () => {
    const p = autoPlan(bed(4, 8, { sunnySide: 'back' }), food);
    expect(rowsOf('tomato', p)).toEqual([6]);
  });
  it('puts tall plants on the right when the sun is on the left', () => {
    const p = autoPlan(bed(8, 4, { sunnySide: 'left' }), ['sunflower', 'lettuce']);
    const avg = (id: string) => {
      const xs = p.plantings.filter((x) => x.plantId === id).map((x) => x.x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avg('sunflower')).toBeGreaterThan(avg('lettuce'));
  });
  it('keeps low plants nearer the sun than tall ones', () => {
    const p = autoPlan(bed(4, 4), ['sunflower', 'lettuce']);
    expect(Math.max(...rowsOf('sunflower', p))).toBeLessThanOrEqual(Math.min(...rowsOf('lettuce', p)));
  });
  it('keeps each crop in one connected patch', () => {
    const p = autoPlan(bed(4, 6), ['pepper', 'bushbean', 'lettuce', 'carrot', 'basil', 'marigold']);
    for (const id of ['pepper', 'bushbean', 'lettuce', 'carrot', 'basil', 'marigold']) {
      const mine = p.plantings.filter((x) => x.plantId === id);
      expect(mine.length).toBe(4);
      expect(mine.every((a) => mine.some((b) => a !== b && touches(rectOf(a), rectOf(b))))).toBe(true);
    }
  });
  it('fills the whole bed even when only a few crops are chosen', () => {
    const p = autoPlan(bed(6, 6), ['lettuce', 'carrot']);
    expect(p.plantings).toHaveLength(36);
    expect(p.plantings.filter((x) => x.plantId === 'lettuce')).toHaveLength(18);
  });
  it('fills a big bed', () => {
    const p = autoPlan(bed(12, 8), starterSet('food', 'full', 96));
    const tiles = p.plantings.reduce((n, x) => n + rectOf(x).w * rectOf(x).h, 0);
    expect(tiles).toBe(96);
  });
  it('adds more big plants when only big plants are chosen', () => {
    const p = autoPlan(bed(4, 4), ['tomato']);
    expect(p.plantings).toHaveLength(4);
    expect(noOverlaps(p.plantings)).toBe(true);
  });
  it('shares leftover tiles fairly', () => {
    const p = autoPlan(bed(3, 3), ['lettuce', 'carrot', 'radish']);
    const n = (id: string) => p.plantings.filter((x) => x.plantId === id).length;
    expect([n('lettuce'), n('carrot'), n('radish')]).toEqual([3, 3, 3]);
  });
  it('places only one of each big plant', () => expect(rowsOf('tomato')).toHaveLength(1));
  it('explains every placement in a sentence', () => {
    expect(Object.keys(plan.reasons).sort()).toEqual([...food].sort());
    expect(plan.reasons.tomato).toBe('Tomatoes get their full 2 × 2 ft, so they were placed first.');
    expect(plan.reasons.lettuce).toContain('sunny edge');
  });
  it('does not claim to know the sun when the sunny side is unmarked', () => {
    const p = autoPlan(bed(4, 4, { sunnySide: null }), ['sunflower', 'lettuce']);
    expect(p.reasons.sunflower).toContain("Mark the bed's sunny side");
  });
  it('says so when a plant does not fit', () => {
    const p = autoPlan(bed(2, 2), ['zucchini', 'lettuce']);
    expect(p.unplaced).toEqual([{ plantId: 'zucchini', reason: 'No room left for zucchini: it needs 3 × 3 ft to itself.' }]);
    expect(p.plantings.every((x) => x.plantId === 'lettuce')).toBe(true);
  });
  it('reports plants squeezed out of a tiny bed', () => {
    const p = autoPlan(bed(1, 2), ['lettuce', 'carrot', 'radish']);
    expect(p.plantings).toHaveLength(2);
    expect(p.unplaced.map((u) => u.plantId)).toEqual(['radish']);
  });
  it('ignores duplicates and unknown plants', () => {
    const p = autoPlan(bed(2, 1), ['lettuce', 'lettuce', 'triffid']);
    expect(p.plantings.map((x) => x.plantId)).toEqual(['lettuce', 'lettuce']);
    expect(p.unplaced).toEqual([]);
  });
  it('returns an empty plan for no plants', () => expect(autoPlan(bed(4, 4), []).plantings).toEqual([]));
  it('gives the same plan every time', () => expect(autoPlan(bed(4, 8), food)).toEqual(plan));
  it('handles the largest bed without overlaps', () => {
    const p = autoPlan(bed(12, 8), PLANTS.map((x) => x.id));
    expect(noOverlaps(p.plantings)).toBe(true);
    expect(p.unplaced).toEqual([]);
  });
});

describe('starter sets', () => {
  it('suggests a food garden for a sunny 4 × 8 bed', () => {
    expect(starterSet('food', 'full', 32)).toEqual(['tomato', 'pepper', 'bushbean', 'lettuce', 'carrot', 'radish', 'basil', 'marigold']);
  });
  it('leaves sun-lovers out of a part-sun bed', () => {
    const ids = starterSet('food', 'part', 32);
    expect(ids).not.toContain('tomato');
    expect(ids.every((id) => getPlant(id)!.sun === 'part')).toBe(true);
    expect(ids.length).toBeGreaterThan(3);
  });
  it('skips big plants in a small bed', () => expect(starterSet('food', 'full', 8)).not.toContain('tomato'));
  it('keeps small beds to a short list', () => expect(starterSet('mix', 'full', 8)).toHaveLength(4));
  it('offers only flowers for a flower garden', () => {
    expect(starterSet('flowers', 'full', 32).every((id) => getPlant(id)!.category === 'flower')).toBe(true);
  });
  it('always fits what it suggests', () => {
    for (const goal of ['food', 'flowers', 'pollinators', 'mix'] as const) {
      for (const [c, r] of [[2, 2], [4, 4], [4, 8], [3, 6]]) {
        expect(autoPlan(bed(c, r), starterSet(goal, 'full', c * r)).unplaced).toEqual([]);
      }
    }
  });
});

describe('resizing the bed', () => {
  it('keeps plants that still fit', () => {
    const p = [at('carrot', 1, 1)];
    expect(fitToBed(bed(2, 2), p)).toEqual(p);
  });
  it('drops plants that are now outside', () => expect(fitToBed(bed(2, 2), [at('carrot', 3, 3)])).toEqual([]));
  it('slides a big plant back in if the bed still has room', () => {
    expect(fitToBed(bed(3, 3), [at('tomato', 2, 2)])[0]).toMatchObject({ x: 1, y: 1 });
  });
  it('drops a big plant the bed can no longer hold', () => expect(fitToBed(bed(2, 2), [at('zucchini', 0, 0)])).toEqual([]));
});
