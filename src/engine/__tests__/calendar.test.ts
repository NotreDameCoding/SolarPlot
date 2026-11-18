import { describe, expect, it } from 'vitest';
import { calendarsFor, effectiveDtm, fallCalendar, plantingStatus, springCalendar, warmGate } from '../calendar';
import { addDays } from '../dates';
import { frostFromHistory } from '../frost';
import { PLANTS, plantOrThrow } from '../plants';
import { HOUSTON, MONTANA, OHIO, yearOfLows } from './helpers';

const P = plantOrThrow;
const spring = (id: string, frost = OHIO) => springCalendar(P(id), frost, 2027)!;
const fall = (id: string, frost = OHIO) => fallCalendar(P(id), frost, 2027)!;

describe('spring planting windows (last frost Apr 20, 10%-risk date May 4)', () => {
  it('sends hardy crops out 4 to 6 weeks before the average last frost', () => {
    expect(spring('pea').plantOut).toEqual({ start: '2027-03-09', end: '2027-03-23' });
  });
  it('sends semi-hardy crops out in the 2 weeks before last frost', () => {
    expect(spring('lettuce').plantOut).toEqual({ start: '2027-04-06', end: '2027-04-20' });
  });
  it('holds tender crops until the 10%-risk date', () => {
    expect(spring('bushbean').plantOut).toEqual({ start: '2027-05-04', end: '2027-05-25' });
  });
  it('holds very tender crops 2 to 3 weeks longer', () => {
    expect(spring('pepper').plantOut).toEqual({ start: '2027-05-18', end: '2027-05-25' });
  });
  it('never puts a tender crop out before the average last frost', () => {
    const early = PLANTS.filter((p) => p.frost === 'tender' || p.frost === 'veryTender').filter((p) => spring(p.id).plantOut.start < '2027-04-20');
    expect(early.map((p) => p.id)).toEqual([]);
  });
  it('orders the classes hardy, semi-hardy, tender, very tender', () => {
    const starts = ['spinach', 'carrot', 'tomato', 'basil'].map((id) => spring(id).plantOut.start);
    expect([...starts].sort()).toEqual(starts);
  });
  it('starts tomato seeds indoors 6 weeks before they go out', () => {
    expect(spring('tomato').startIndoors).toEqual({ start: '2027-03-23', end: '2027-04-06' });
  });
  it('gives direct-sown crops no indoor start', () => expect(spring('carrot').startIndoors).toBeUndefined());
  it('counts tomato harvest from transplanting', () => expect(spring('tomato').harvest.start).toBe('2027-07-18'));
  it('counts radish harvest from sowing', () => expect(spring('radish').harvest.start).toBe(addDays('2027-03-09', 28)));
  it('explains each window in one sentence that names the date', () => {
    expect(spring('pea').why).toBe('Snap pea shrugs off frost, so it goes out 4 to 6 weeks before your average last frost (Apr 20).');
    expect(spring('tomato').why).toContain('May 4');
  });
  it('tells warm crops to wait for warm soil and nights', () => {
    expect(spring('pepper').notes.join(' ')).toContain('soil near 65°F and nights above 55°F');
  });
  it('lets warm crops go in late as long as they finish before fall frost', () => {
    // Bush beans: first frost Oct 15, minus 55 days to grow, minus 2 weeks.
    expect(spring('bushbean').lastChance).toBe('2027-08-07');
  });
  it('closes the cool-crop window 3 weeks after it ends', () => expect(spring('pea').lastChance).toBe('2027-04-13'));
  it('skips garlic in spring because it is planted in fall', () => expect(springCalendar(P('garlic'), OHIO, 2027)).toBeNull());
  it('gives every other plant a spring window with harvest after planting', () => {
    for (const p of PLANTS.filter((x) => !x.overwinter)) {
      const c = spring(p.id);
      expect(c.plantOut.start <= c.plantOut.end).toBe(true);
      expect(c.harvest.start > c.plantOut.start).toBe(true);
      expect(c.lastChance >= c.plantOut.end).toBe(true);
    }
  });
});

describe('harvests and fall frost', () => {
  it('stops a tender harvest at the first fall frost', () => {
    // Montana: first frost Sep 5. Tomatoes could otherwise "harvest" into November.
    expect(spring('tomato', MONTANA).harvest.end).toBe('2027-09-05');
  });
  it('gives frost-hardy crops a few extra weeks past first frost', () => {
    expect(spring('kale', MONTANA).harvest.end <= '2027-10-10').toBe(true);
  });
  it('leaves harvests that end before frost alone', () => {
    expect(spring('radish').harvest.end).toBe('2027-04-30');
  });
  it('never ends a harvest before it starts', () => {
    for (const p of PLANTS.filter((x) => !x.overwinter)) {
      const c = spring(p.id, MONTANA);
      expect(c.harvest.end >= c.harvest.start).toBe(true);
    }
  });
});

describe('days to maturity', () => {
  it('uses the packet number when the method matches', () => expect(effectiveDtm(P('tomato'), 'transplant')).toBe(75));
  it('subtracts indoor time when a seed-counted crop goes in as a seedling', () => {
    expect(effectiveDtm(P('lettuce'), 'transplant')).toBe(50 - 28);
  });
  it('adds indoor time when a transplant-counted crop is sown direct', () => {
    expect(effectiveDtm(P('kale'), 'seed')).toBe(55 + 35);
  });
  it('never drops below two weeks', () => expect(effectiveDtm(P('marigold'), 'transplant')).toBe(14));
});

describe('fall planting windows (first frost Oct 15)', () => {
  it('counts lettuce back from first frost with a 2-week buffer', () => {
    expect(fall('lettuce').plantOut).toEqual({ start: '2027-07-22', end: '2027-08-12' });
  });
  it('lets hardy spinach skip the buffer', () => expect(fall('spinach').plantOut.end).toBe('2027-09-05'));
  it('has no fall window for summer crops', () => {
    expect(fallCalendar(P('tomato'), OHIO, 2027)).toBeNull();
    expect(fallCalendar(P('pepper'), OHIO, 2027)).toBeNull();
  });
  it('plants garlic around first frost and harvests it next summer', () => {
    const c = fall('garlic');
    expect(c.season).toBe('overwinter');
    expect(c.plantOut).toEqual({ start: '2027-10-01', end: '2027-11-05' });
    expect(c.harvest.start).toBe('2028-06-27');
  });
  it('moves fall dates earlier where frost comes earlier', () => {
    expect(fall('lettuce', MONTANA).plantOut.end < fall('lettuce').plantOut.end).toBe(true);
  });
  it('lists spring before fall', () => {
    expect(calendarsFor(P('lettuce'), OHIO, 2027).map((c) => c.season)).toEqual(['spring', 'fall']);
  });
  it('gives garlic only its fall planting', () => {
    expect(calendarsFor(P('garlic'), OHIO, 2027).map((c) => c.season)).toEqual(['overwinter']);
  });
});

describe('hot and frost-free climates', () => {
  const tropical = frostFromHistory(Array.from({ length: 10 }, (_, i) => yearOfLows(2016 + i, null, null)).flat());
  it('warns that summer is the off-season for cool crops in zone 9', () => {
    expect(spring('lettuce', HOUSTON).notes.join(' ')).toContain('off-season');
  });
  it('flags tomatoes for heat in zone 9', () => expect(spring('tomato', HOUSTON).notes.join(' ')).toContain('90°F'));
  it('does not add heat warnings in zone 6', () => expect(spring('lettuce').notes).toEqual([]));
  it('grows cool crops through winter where there is no frost', () => {
    const c = fallCalendar(P('lettuce'), tropical, 2027)!;
    expect(c.season).toBe('cool-season');
    expect(c.plantOut).toEqual({ start: '2027-10-01', end: '2028-01-31' });
    expect(springCalendar(P('lettuce'), tropical, 2027)).toBeNull();
  });
  it('plants warm crops in late winter where there is no frost', () => {
    expect(springCalendar(P('tomato'), tropical, 2027)!.plantOut.start).toBe('2027-02-15');
  });
  it('gives no calendar when frost dates are unknown', () => {
    expect(calendarsFor(P('tomato'), frostFromHistory([]), 2027)).toEqual([]);
  });
});

describe('warm-crop gate', () => {
  it('passes crops that do not need warmth', () => expect(warmGate(P('pea'), { nightLowsF: [20] }).ok).toBe(true));
  it('holds tomatoes when a night dips below 50°F', () => {
    const g = warmGate(P('tomato'), { nightLowsF: [58, 47, 55] });
    expect(g.ok).toBe(false);
    expect(g.reason).toContain('47°F');
  });
  it('holds tomatoes when the soil is cold even if nights are warm', () => {
    expect(warmGate(P('tomato'), { nightLowsF: [55, 56], soilF: 54 }).ok).toBe(false);
  });
  it('passes when nights and soil are warm', () => expect(warmGate(P('tomato'), { nightLowsF: [52, 60], soilF: 63 }).ok).toBe(true));
  it('passes when there is no forecast to judge by', () => expect(warmGate(P('tomato'), {}).ok).toBe(true));
});

describe('what to do today', () => {
  const tomato = spring('tomato');
  it('says to start seeds indoors during the indoor window', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-03-25').state).toBe('indoors');
  });
  it('says too early before anything can happen', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-02-01').state).toBe('early');
  });
  it('counts down once seedlings are growing', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-04-27').text).toBe('Seedlings go outside in 7 days.');
  });
  it('says plant now inside the window', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-05-10', { nightLowsF: [55] })).toEqual({ state: 'now', text: 'Plant out now.' });
  });
  it('refuses to say plant now on a cold week, whatever the calendar says', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-05-10', { nightLowsF: [44] }).state).toBe('wait-warm');
  });
  it('says late but fine after the window', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-06-20').state).toBe('late');
  });
  it('says the window has passed when the season is too short', () => {
    expect(plantingStatus(P('tomato'), tomato, '2027-08-01').state).toBe('past');
  });
  it('uses "sow" for direct-sown crops', () => {
    expect(plantingStatus(P('carrot'), spring('carrot'), '2027-04-10').text).toBe('Sow now.');
  });
});
