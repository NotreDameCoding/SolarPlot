import { describe, expect, it } from 'vitest';
import { getPlant, PLANTS, plantOrThrow, plural } from '../plants';

const SPRITES = ['sun', 'tom', 'bean', 'pep', 'bas', 'kal', 'zin', 'mar', 'let', 'letr', 'car', 'oni', 'str', 'spi', 'rad', 'squ', 'cab', 'gar', 'corn'];
const ids = new Set(PLANTS.map((p) => p.id));

describe('plant database', () => {
  it('has the 40 launch plants', () => expect(PLANTS).toHaveLength(40));
  it('has 22 vegetables, 10 herbs and 8 flowers', () => {
    const count = (c: string) => PLANTS.filter((p) => p.category === c).length;
    expect([count('vegetable'), count('herb'), count('flower')]).toEqual([22, 10, 8]);
  });
  it('has no duplicate ids', () => expect(ids.size).toBe(PLANTS.length));
  it('only names companions that exist', () => {
    const bad = PLANTS.flatMap((p) => [...p.friends, ...p.foes].filter((id) => !ids.has(id)).map((id) => `${p.id}->${id}`));
    expect(bad).toEqual([]);
  });
  it('never lists the same plant as friend and foe', () => {
    const bad = PLANTS.filter((p) => p.friends.some((f) => p.foes.includes(f) || getPlant(f)!.foes.includes(p.id)));
    expect(bad.map((p) => p.id)).toEqual([]);
  });
  it('never lists a plant as its own companion', () => {
    expect(PLANTS.filter((p) => p.friends.includes(p.id) || p.foes.includes(p.id))).toEqual([]);
  });
  it('gives every plant a sprite the scene can draw', () => {
    expect(PLANTS.filter((p) => !SPRITES.includes(p.sprite)).map((p) => p.id)).toEqual([]);
  });
  it('uses real square-foot densities', () => {
    expect(PLANTS.filter((p) => ![1, 2, 4, 8, 9, 16].includes(p.perSqFt)).map((p) => p.id)).toEqual([]);
  });
  it('gives big plants one plant per footprint', () => {
    const big = PLANTS.filter((p) => p.footprint[0] * p.footprint[1] > 1);
    expect(big.map((p) => p.id).sort()).toEqual(['tomato', 'wintersquash', 'zucchini']);
    expect(big.every((p) => p.perSqFt === 1)).toBe(true);
  });
  it('gives every transplanted crop an indoor start time', () => {
    const bad = PLANTS.filter((p) => p.start.includes('transplant') && p.indoorWeeks === undefined);
    expect(bad.map((p) => p.id)).toEqual([]);
  });
  it('gives every tender crop a warm-soil and warm-night gate', () => {
    const tender = PLANTS.filter((p) => (p.frost === 'tender' || p.frost === 'veryTender') && !p.perennial);
    expect(tender.filter((p) => !p.minSoilF || !p.minNightF).map((p) => p.id)).toEqual([]);
  });
  it('never gives a frost-hardy crop a warm gate', () => {
    expect(PLANTS.filter((p) => p.frost === 'hardy' && p.minNightF).map((p) => p.id)).toEqual([]);
  });
  it('keeps numbers in a sane range', () => {
    for (const p of PLANTS) {
      expect(p.dtm).toBeGreaterThan(20);
      expect(p.dtm).toBeLessThan(300);
      expect(p.harvestDays).toBeGreaterThan(0);
      expect(p.waterIn).toBeGreaterThanOrEqual(1);
      expect(p.waterIn).toBeLessThanOrEqual(2);
      expect(p.minPotGal).toBeGreaterThan(0);
      expect(p.start.length).toBeGreaterThan(0);
    }
  });
  it('writes care notes and a source for every plant', () => {
    expect(PLANTS.filter((p) => p.care.length < 40 || !p.source).map((p) => p.id)).toEqual([]);
  });
  it('classes the blueprint examples correctly', () => {
    expect(plantOrThrow('pea').frost).toBe('hardy');
    expect(plantOrThrow('spinach').frost).toBe('hardy');
    expect(plantOrThrow('onion').frost).toBe('hardy');
    expect(plantOrThrow('tomato').frost).toBe('tender');
    expect(plantOrThrow('bushbean').frost).toBe('tender');
    expect(plantOrThrow('pepper').frost).toBe('veryTender');
    expect(plantOrThrow('basil').frost).toBe('veryTender');
  });
  it('looks plants up by id', () => {
    expect(getPlant('kale')?.name).toBe('Kale');
    expect(getPlant('triffid')).toBeUndefined();
    expect(() => plantOrThrow('triffid')).toThrow();
  });
  it('makes sensible plurals', () => {
    expect(plural(plantOrThrow('tomato'))).toBe('Tomatoes');
    expect(plural(plantOrThrow('strawberry'))).toBe('Strawberries');
    expect(plural(plantOrThrow('carrot'))).toBe('Carrots');
    expect(plural(plantOrThrow('zucchini'))).toBe('Zucchini');
    expect(plural(plantOrThrow('radish'))).toBe('Radishes');
    expect(plural(plantOrThrow('wintersquash'))).toBe('Butternut squash');
  });
});
