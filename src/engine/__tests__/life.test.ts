import { describe, expect, it } from 'vitest';
import { growth } from '../growth';
import { fmtTotal, harvestsCsv, harvestTotals } from '../harvest';
import { plantOrThrow } from '../plants';
import { decodeShare, encodeShare } from '../share';
import type { Harvest } from '../types';
import { wateringNudge, weeklyNeedIn } from '../watering';
import { at, bed } from './helpers';

describe('growth phases', () => {
  const radish = plantOrThrow('radish'); // 28 days from seed
  const tomato = plantOrThrow('tomato'); // 75 days from transplant
  it('shows a planting with no date as planned', () => {
    expect(growth(radish, at('radish', 0, 0), '2027-05-01')).toMatchObject({ phase: 'planned', fraction: 0 });
  });
  it('shows a future planting date as planned', () => {
    expect(growth(radish, at('radish', 0, 0, { plantedOn: '2027-06-01' }), '2027-05-01').phase).toBe('planned');
  });
  it('starts seeds at zero', () => {
    expect(growth(radish, at('radish', 0, 0, { plantedOn: '2027-05-01' }), '2027-05-01')).toMatchObject({ phase: 'seed', fraction: 0, daysIn: 0 });
  });
  it('is half grown at half its days to maturity', () => {
    const g = growth(radish, at('radish', 0, 0, { plantedOn: '2027-05-01' }), '2027-05-15');
    expect(g.fraction).toBeCloseTo(0.5);
    expect(g.phase).toBe('young');
  });
  it('is ready to harvest at its days to maturity', () => {
    const g = growth(radish, at('radish', 0, 0, { plantedOn: '2027-05-01' }), '2027-05-29');
    expect(g).toMatchObject({ phase: 'harvest', fraction: 1, harvestFrom: '2027-05-29', harvestTo: '2027-06-08' });
  });
  it('is finished after the harvest window', () => {
    expect(growth(radish, at('radish', 0, 0, { plantedOn: '2027-05-01' }), '2027-07-01').phase).toBe('done');
  });
  it('gives seedlings a head start', () => {
    const g = growth(tomato, at('tomato', 0, 0, { plantedOn: '2027-05-10' }), '2027-05-10');
    expect(g.fraction).toBe(0.1);
    expect(g.phase).toBe('sprout');
  });
  it('never calls a perennial finished', () => {
    const chives = plantOrThrow('chives');
    expect(growth(chives, at('chives', 0, 0, { plantedOn: '2025-05-01' }), '2027-07-01').phase).toBe('harvest');
  });
  it('never grows past full size', () => {
    expect(growth(tomato, at('tomato', 0, 0, { plantedOn: '2027-05-10' }), '2027-08-20').fraction).toBe(1);
  });
});

describe('weekly watering nudge', () => {
  it('says rain covered it after an inch or more', () => {
    const n = wateringNudge(1.2, 0);
    expect(n.water).toBe(false);
    expect(n.text).toBe('Rain covered it this week (1.2 inches fell). No watering needed.');
  });
  it('says to water the missing amount after a dry week', () => {
    const n = wateringNudge(0, 0);
    expect(n).toMatchObject({ water: true, amountIn: 1 });
    expect(n.text).toContain('about 1 inch needed');
  });
  it('rounds the amount up to a quarter inch', () => expect(wateringNudge(0.4, 0).amountIn).toBe(0.75));
  it('holds off when enough rain is forecast', () => {
    const n = wateringNudge(0.3, 0.9);
    expect(n.water).toBe(false);
    expect(n.text).toContain('Hold off');
  });
  it('counts forecast rain toward a smaller top-up', () => expect(wateringNudge(0.2, 0.3).amountIn).toBe(0.5));
  it('asks for more water for thirsty crops', () => expect(wateringNudge(1.2, 0, 1.5).water).toBe(true));
  it('treats bad readings as no rain', () => expect(wateringNudge(-1, -1).amountIn).toBe(1));
  it('lets the thirstiest plant set the need', () => {
    expect(weeklyNeedIn([at('lettuce', 0, 0), at('tomato', 1, 0)])).toBe(1.5);
    expect(weeklyNeedIn([at('lettuce', 0, 0)])).toBe(1);
    expect(weeklyNeedIn([])).toBe(1);
  });
});

describe('harvest log', () => {
  const log: Harvest[] = [
    { id: 'h1', plantId: 'tomato', date: '2027-08-01', amount: 2, unit: 'lb' },
    { id: 'h2', plantId: 'tomato', date: '2027-08-09', amount: 8, unit: 'oz' },
    { id: 'h3', plantId: 'tomato', date: '2027-08-12', amount: 6, unit: 'count' },
    { id: 'h4', plantId: 'basil', date: '2027-07-04', amount: 100, unit: 'g', note: 'pesto, "the good kind"' },
    { id: 'h5', plantId: 'kale', date: '2026-10-10', amount: 1, unit: 'kg' },
  ];
  it('adds up weights in pounds and keeps counts separate', () => {
    const tomato = harvestTotals(log).find((t) => t.plantId === 'tomato')!;
    expect(tomato.lb).toBeCloseTo(2.5);
    expect(tomato.count).toBe(6);
    expect(tomato.entries).toBe(3);
  });
  it('converts metric weights', () => {
    expect(harvestTotals(log).find((t) => t.plantId === 'kale')!.lb).toBeCloseTo(2.205, 2);
  });
  it('can total a single year', () => {
    expect(harvestTotals(log, 2027).map((t) => t.plantId)).toEqual(['tomato', 'basil']);
  });
  it('lists the biggest harvest first', () => expect(harvestTotals(log)[0].plantId).toBe('tomato'));
  it('skips zero and negative amounts', () => {
    expect(harvestTotals([{ id: 'x', plantId: 'kale', date: '2027-01-01', amount: 0, unit: 'lb' }])).toEqual([]);
  });
  it('formats totals for people', () => {
    expect(fmtTotal({ lb: 2.5, count: 6 })).toBe('2.5 lb + 6 picked');
    expect(fmtTotal({ lb: 0.22, count: 0 })).toBe('4 oz');
    expect(fmtTotal({ lb: 0, count: 0 })).toBe('nothing yet');
  });
  it('exports CSV oldest first with plant names', () => {
    const lines = harvestsCsv(log).trim().split('\n');
    expect(lines[0]).toBe('date,plant,amount,unit,note');
    expect(lines[1]).toBe('2026-10-10,Kale,1,kg,');
    expect(lines).toHaveLength(6);
  });
  it('quotes notes that contain commas and quotes', () => {
    expect(harvestsCsv(log)).toContain('2027-07-04,Basil,100,g,"pesto, ""the good kind"""');
  });
});

describe('share links', () => {
  const g = bed(4, 8, { name: "Blake's bed", sun: 'part' });
  const plantings = [at('tomato', 0, 0, { plantedOn: '2027-05-10' }), at('basil', 2, 0), at('carrot', 3, 7)];
  const code = encodeShare(g, plantings, 'Columbus, Ohio');
  it('round-trips the layout', () => {
    const back = decodeShare(code)!;
    expect(back.garden).toMatchObject({ name: "Blake's bed", cols: 4, rows: 8, sun: 'part', type: 'raised' });
    expect(back.plantings.map((p) => [p.plantId, p.x, p.y])).toEqual([['tomato', 0, 0], ['basil', 2, 0], ['carrot', 3, 7]]);
    expect(back.city).toBe('Columbus, Ohio');
  });
  it('is safe to put in a URL', () => expect(code).toMatch(/^[A-Za-z0-9_-]+$/));
  it('leaves planting dates out of the link', () => expect(decodeShare(code)!.plantings[0].plantedOn).toBeUndefined());
  it('keeps names with accents and emoji', () => {
    expect(decodeShare(encodeShare({ ...g, name: 'Jardín 🌻' }, []))!.garden.name).toBe('Jardín 🌻');
  });
  it('rejects garbage', () => {
    expect(decodeShare('not a real code')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });
  it('rejects a link with a plant outside the bed', () => {
    const bad = btoa(JSON.stringify({ v: 1, n: 'x', c: '', t: 0, w: 2, h: 2, s: 0, p: [[0, 5, 0]] }));
    expect(decodeShare(bad)).toBeNull();
  });
  it('rejects a link with an oversized bed or unknown plant', () => {
    expect(decodeShare(btoa(JSON.stringify({ v: 1, w: 500, h: 2, s: 0, p: [] })))).toBeNull();
    expect(decodeShare(btoa(JSON.stringify({ v: 1, w: 2, h: 2, s: 0, p: [[999, 0, 0]] })))).toBeNull();
  });
  it('rejects a link from a future format', () => {
    expect(decodeShare(btoa(JSON.stringify({ v: 2, w: 2, h: 2, s: 0, p: [] })))).toBeNull();
  });
});
