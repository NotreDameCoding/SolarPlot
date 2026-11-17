import { describe, expect, it } from 'vitest';
import { plantOrThrow } from '../plants';
import { frostAlert, parseNws, parseOpenMeteo, sceneMode, skyFromText, skyFromWmo, wmoText } from '../weather';

const period = (over: object) => ({
  startTime: '2027-05-10T18:00:00-04:00', endTime: '2027-05-11T06:00:00-04:00', isDaytime: false,
  temperature: 50, temperatureUnit: 'F', shortForecast: 'Mostly Clear', ...over,
});
const nws = (periods: object[]) => ({ properties: { periods } });

describe('reading the sky', () => {
  it('reads NWS rain wording', () => {
    expect(skyFromText('Chance Rain Showers')).toBe('rain');
    expect(skyFromText('Slight Chance Showers And Thunderstorms')).toBe('rain');
    expect(skyFromText('Patchy Drizzle')).toBe('rain');
  });
  it('reads NWS snow wording, and lets snow win over rain', () => {
    expect(skyFromText('Light Snow')).toBe('snow');
    expect(skyFromText('Rain And Snow Showers')).toBe('snow');
    expect(skyFromText('Wintry Mix')).toBe('snow');
  });
  it('reads clear and cloudy skies', () => {
    expect(skyFromText('Sunny')).toBe('clear');
    expect(skyFromText('Partly Cloudy')).toBe('clear');
    expect(skyFromText('Mostly Cloudy')).toBe('cloudy');
    expect(skyFromText('')).toBe('clear');
  });
  it('reads WMO weather codes', () => {
    expect(skyFromWmo(0)).toBe('clear');
    expect(skyFromWmo(3)).toBe('cloudy');
    expect(skyFromWmo(61)).toBe('rain');
    expect(skyFromWmo(73)).toBe('snow');
    expect(skyFromWmo(81)).toBe('rain');
    expect(skyFromWmo(86)).toBe('snow');
    expect(skyFromWmo(95)).toBe('rain');
  });
  it('names WMO codes', () => {
    expect(wmoText(0)).toBe('Clear');
    expect(wmoText(63)).toBe('Rain');
    expect(wmoText(75)).toBe('Snow');
  });
});

describe('choosing the scene', () => {
  it('shows a clear day', () => expect(sceneMode({ sky: 'clear', isDay: true })).toBe('clear'));
  it('shows night after dark', () => expect(sceneMode({ sky: 'cloudy', isDay: false })).toBe('night'));
  it('shows rain, even at night', () => expect(sceneMode({ sky: 'rain', isDay: false })).toBe('rain'));
  it('shows snow', () => expect(sceneMode({ sky: 'snow', isDay: true })).toBe('snow'));
  it('shows overcast days as clear, since there is no cloudy scene yet', () => expect(sceneMode({ sky: 'cloudy', isDay: true })).toBe('clear'));
  it('falls back to clear when the weather service is down', () => expect(sceneMode(null)).toBe('clear'));
});

describe('National Weather Service forecasts', () => {
  const hourly = nws([period({ isDaytime: true, temperature: 64, shortForecast: 'Light Rain' })]);
  const daily = nws([
    period({ isDaytime: true, temperature: 70, startTime: '2027-05-10T06:00:00-04:00', endTime: '2027-05-10T18:00:00-04:00' }),
    period({ temperature: 41 }),
    period({ isDaytime: true, temperature: 66, startTime: '2027-05-11T06:00:00-04:00', endTime: '2027-05-11T18:00:00-04:00' }),
    period({ temperature: 35, startTime: '2027-05-11T18:00:00-04:00', endTime: '2027-05-12T06:00:00-04:00' }),
  ]);
  it('reads current conditions from the hourly forecast', () => {
    expect(parseNws(hourly, daily)).toMatchObject({ tempF: 64, isDay: true, sky: 'rain', text: 'Light Rain' });
  });
  it('takes overnight lows from the night periods, dated by the morning', () => {
    expect(parseNws(hourly, daily)!.lows).toEqual([{ date: '2027-05-11', lowF: 41 }, { date: '2027-05-12', lowF: 35 }]);
  });
  it('converts Celsius', () => {
    const c = nws([period({ temperature: 10, temperatureUnit: 'C' })]);
    expect(parseNws(c, c)!.tempF).toBe(50);
  });
  it('returns null for an error page or empty forecast', () => {
    expect(parseNws({ status: 503 }, daily)).toBeNull();
    expect(parseNws(hourly, nws([]))).toBeNull();
    expect(parseNws(null, null)).toBeNull();
  });
});

describe('Open-Meteo forecasts', () => {
  const days = ['2027-05-03', '2027-05-04', '2027-05-05', '2027-05-06', '2027-05-07', '2027-05-08', '2027-05-09', '2027-05-10', '2027-05-11', '2027-05-12', '2027-05-13'];
  const json = {
    current: { temperature_2m: 58.4, is_day: 0, weather_code: 71, soil_temperature_6cm: 55.6 },
    daily: {
      time: days,
      temperature_2m_min: [40, 41, 42, 43, 44, 45, 46, 47, 34, 49, 50],
      precipitation_sum: [0.1, 0, 0, 0.25, 0, 0, 0.05, 0.2, 0.3, null, 2],
    },
  };
  const w = parseOpenMeteo(json, '2027-05-10')!;
  it('reads current conditions', () => expect(w).toMatchObject({ tempF: 58, isDay: false, sky: 'snow', text: 'Snow', soilF: 56 }));
  it('adds up the last 7 days of rain, not counting today', () => expect(w.pastRainIn).toBe(0.4));
  it('adds up rain for today and the next 2 days', () => expect(w.nextRainIn).toBe(0.5));
  it('lists lows from today onward', () => {
    expect(w.lows[0]).toEqual({ date: '2027-05-10', lowF: 47 });
    expect(w.lows).toHaveLength(4);
  });
  it('reports unknown rain as unknown, not zero', () => {
    const dry = parseOpenMeteo({ current: {}, daily: { time: days } }, '2027-05-10')!;
    expect(dry.pastRainIn).toBeNull();
    expect(dry.soilF).toBeNull();
  });
  it('returns null for a broken response', () => {
    expect(parseOpenMeteo({ error: true }, '2027-05-10')).toBeNull();
    expect(parseOpenMeteo(null, '2027-05-10')).toBeNull();
  });
});

describe('frost alerts', () => {
  const tomato = plantOrThrow('tomato');
  const lettuce = plantOrThrow('lettuce');
  const kale = plantOrThrow('kale');
  const lows = (...f: number[]) => f.map((lowF, i) => ({ date: `2027-05-1${i}`, lowF }));
  it('stays quiet above 36°F', () => expect(frostAlert(lows(37, 45, 50), '2027-05-10', [tomato])).toBeNull());
  it('alerts at 36°F, before the air reaches freezing', () => {
    expect(frostAlert(lows(36), '2027-05-10', [tomato])).toMatchObject({ level: 'frost', lowF: 36, plants: ['Tomato'] });
  });
  it('calls 28°F or below a hard freeze', () => expect(frostAlert(lows(28), '2027-05-10', [tomato])!.level).toBe('freeze'));
  it('names only the plants a light frost will hurt', () => {
    expect(frostAlert(lows(33), '2027-05-10', [tomato, lettuce, kale])!.plants).toEqual(['Tomato']);
  });
  it('adds semi-hardy plants in a hard freeze, but never hardy ones', () => {
    expect(frostAlert(lows(25), '2027-05-10', [tomato, lettuce, kale])!.plants).toEqual(['Tomato', 'Leaf lettuce']);
  });
  it('picks the coldest of the next three mornings', () => {
    const a = frostAlert(lows(35, 30, 33), '2027-05-10', [tomato])!;
    expect(a).toMatchObject({ date: '2027-05-11', lowF: 30 });
    expect(a.text).toBe('Frost likely on the morning of May 11: low of 30°F. Cover or bring in: Tomato.');
  });
  it('ignores cold more than three mornings away', () => {
    expect(frostAlert(lows(50, 50, 50, 20), '2027-05-10', [tomato])).toBeNull();
  });
  it('ignores yesterday', () => expect(frostAlert([{ date: '2027-05-09', lowF: 20 }], '2027-05-10', [tomato])).toBeNull());
  it('names each plant once', () => {
    expect(frostAlert(lows(30), '2027-05-10', [tomato, tomato])!.plants).toEqual(['Tomato']);
  });
  it('reassures when nothing in the ground is at risk', () => {
    const a = frostAlert(lows(34), '2027-05-10', [kale])!;
    expect(a.plants).toEqual([]);
    expect(a.text).toContain('Nothing you have in the ground should mind');
  });
});
