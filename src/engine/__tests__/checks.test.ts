import { describe, expect, it } from 'vitest';
import { autoPlan, checkGarden, starterSet, worstLevels } from '../layout';
import { at, bed, HOUSTON, MONTANA, OHIO } from './helpers';

const texts = (issues: ReturnType<typeof checkGarden>, level?: string) => issues.filter((i) => !level || i.level === level).map((i) => i.text);

describe('hints and warnings', () => {
  it('says nothing about an empty bed', () => expect(checkGarden(bed(), [])).toEqual([]));
  it('says nothing about plants with no opinions about each other', () => {
    expect(checkGarden(bed(), [at('lettuce', 0, 0), at('spinach', 2, 2)])).toEqual([]);
  });

  it('flags two plants on the same tile as too close', () => {
    const issues = checkGarden(bed(), [at('carrot', 0, 0), at('radish', 0, 0)]);
    expect(issues[0].level).toBe('caution');
    expect(issues[0].text).toBe('Too close: carrot and radish will crowd each other.');
    expect(issues[0].fix).toBeDefined();
  });
  it('flags a small plant inside a big footprint', () => {
    const issues = checkGarden(bed(), [at('tomato', 0, 0), at('basil', 1, 1)]);
    expect(texts(issues, 'caution')).toEqual(['Too close: tomato and basil will crowd each other.']);
  });
  it('flags a plant hanging over the edge as a problem with a fix', () => {
    const issues = checkGarden(bed(4, 4), [at('zucchini', 2, 2)]);
    expect(issues[0].level).toBe('problem');
    expect(issues[0].text).toContain('3 × 3 ft');
    expect(issues[0].fix).toBeDefined();
  });

  it('calls full-sun plants in shade a problem, in the blueprint wording', () => {
    const issues = checkGarden(bed(4, 4, { sun: 'shade' }), [at('pepper', 0, 0)]);
    expect(texts(issues, 'problem')).toEqual(['Bell peppers need 6+ hours of sun; this garden gets under 3 hours.']);
  });
  it('calls full-sun plants in part sun a caution', () => {
    expect(checkGarden(bed(4, 4, { sun: 'part' }), [at('pepper', 0, 0)])[0].level).toBe('caution');
  });
  it('accepts part-sun plants in part sun', () => {
    expect(checkGarden(bed(4, 4, { sun: 'part' }), [at('lettuce', 0, 0)])).toEqual([]);
  });
  it('cautions about part-sun plants in shade', () => {
    expect(checkGarden(bed(4, 4, { sun: 'shade' }), [at('lettuce', 0, 0)])[0].level).toBe('caution');
  });
  it('reports sun once per crop, not once per tile', () => {
    const issues = checkGarden(bed(4, 4, { sun: 'shade' }), [at('pepper', 0, 0), at('pepper', 1, 0), at('pepper', 2, 0)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].plantingIds).toHaveLength(3);
  });

  it('warns when the season is too short for a warm crop', () => {
    const issues = checkGarden(bed(), [at('wintersquash', 0, 0)], MONTANA);
    expect(texts(issues, 'problem')[0]).toContain('about 96 days');
  });
  it('does not warn about season length where it is long enough', () => {
    expect(texts(checkGarden(bed(), [at('wintersquash', 0, 0)], OHIO), 'problem')).toEqual([]);
    expect(texts(checkGarden(bed(), [at('tomato', 0, 0)], HOUSTON), 'problem')).toEqual([]);
  });
  it('never warns cool crops about a short season', () => {
    expect(checkGarden(bed(), [at('spinach', 0, 0)], MONTANA)).toEqual([]);
  });

  it('cautions when a tall plant sits on the sunny side of a sun-lover', () => {
    // Sun at the front: the sunflower at y=1 shades the pepper behind it at y=0.
    const issues = checkGarden(bed(), [at('sunflower', 0, 1), at('pepper', 0, 0)]);
    expect(texts(issues, 'caution')).toEqual(['Sunflower will shade the bell pepper behind it for part of the day.']);
  });
  it('is happy when the tall plant is on the far side', () => {
    expect(texts(checkGarden(bed(), [at('sunflower', 0, 0), at('pepper', 0, 1)]), 'caution')).toEqual([]);
  });
  it('follows the sunny side when it is on the left', () => {
    const g = bed(4, 4, { sunnySide: 'left' });
    expect(texts(checkGarden(g, [at('sunflower', 0, 0), at('pepper', 1, 0)]), 'caution')).toHaveLength(1);
    expect(texts(checkGarden(g, [at('sunflower', 1, 0), at('pepper', 0, 0)]), 'caution')).toHaveLength(0);
  });
  it('does not guess about shade when the sunny side is unmarked', () => {
    const g = bed(4, 4, { sunnySide: null });
    expect(texts(checkGarden(g, [at('sunflower', 0, 1), at('pepper', 0, 0)]), 'caution')).toEqual([]);
  });
  it('does not mind shade on plants that tolerate it', () => {
    expect(texts(checkGarden(bed(), [at('sunflower', 0, 1), at('lettuce', 0, 0)]), 'caution')).toEqual([]);
  });
  it('checks the whole back edge of a big plant', () => {
    const issues = checkGarden(bed(), [at('tomato', 0, 1), at('pepper', 1, 0)]);
    expect(texts(issues, 'caution')).toHaveLength(1);
  });

  it('mentions classic companions as a hint, in the blueprint wording', () => {
    const issues = checkGarden(bed(), [at('tomato', 0, 0), at('basil', 2, 0)]);
    expect(texts(issues, 'hint')).toEqual(['Tomatoes and basil are often grown together.']);
  });
  it('words traditional enemies softly, as a hint and never a warning', () => {
    const issues = checkGarden(bed(), [at('bushbean', 0, 0), at('onion', 1, 0)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('hint');
    expect(issues[0].text).toContain('Some gardeners keep');
  });
  it('only mentions companions that are actually next to each other', () => {
    expect(checkGarden(bed(), [at('lettuce', 0, 0), at('carrot', 3, 3)])).toEqual([]);
  });
  it('mentions a pair once however many tiles touch', () => {
    const issues = checkGarden(bed(), [at('lettuce', 0, 0), at('carrot', 1, 0), at('lettuce', 0, 1), at('carrot', 1, 1)]);
    expect(issues).toHaveLength(1);
  });

  it('cautions that mint spreads', () => {
    expect(checkGarden(bed(), [at('mint', 0, 0)])[0].fix).toBe('Grow it in a pot instead.');
  });
  it('hints that corn wants a block', () => {
    expect(texts(checkGarden(bed(), [at('corn', 0, 0), at('corn', 1, 0)]), 'hint')[0]).toContain('block of four');
    const block = [at('corn', 0, 0), at('corn', 1, 0), at('corn', 0, 1), at('corn', 1, 1)];
    expect(checkGarden(bed(), block)).toEqual([]);
  });

  it('lists problems first, then cautions, then hints', () => {
    const issues = checkGarden(bed(4, 4, { sun: 'shade' }), [at('tomato', 0, 0), at('basil', 2, 0), at('basil', 1, 1)]);
    const levels = issues.map((i) => i.level);
    expect(levels).toEqual([...levels].sort((a, b) => ['problem', 'caution', 'hint'].indexOf(a) - ['problem', 'caution', 'hint'].indexOf(b)));
    expect(levels[0]).toBe('problem');
  });
  it('outlines each tile with its most serious issue', () => {
    const tomato = at('tomato', 0, 0);
    const basil = at('basil', 2, 0);
    const levels = worstLevels(checkGarden(bed(4, 4, { sun: 'shade' }), [tomato, basil]));
    expect(levels.get(tomato.id)).toBe('problem');
    expect(levels.get(basil.id)).toBe('problem');
  });
  it('ignores plantings of unknown plants', () => expect(checkGarden(bed(), [at('triffid', 0, 0)])).toEqual([]));

  it('finds nothing worse than a hint in its own starter plans', () => {
    for (const goal of ['food', 'flowers', 'pollinators', 'mix'] as const) {
      const g = bed(4, 8);
      const plan = autoPlan(g, starterSet(goal, 'full', 32));
      expect(checkGarden(g, plan.plantings, OHIO).filter((i) => i.level !== 'hint')).toEqual([]);
    }
  });
});
