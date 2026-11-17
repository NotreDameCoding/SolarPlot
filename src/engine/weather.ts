import { addDays, fmtDate } from './dates';
import type { ISO, Plant } from './types';

export type Sky = 'clear' | 'cloudy' | 'rain' | 'snow';
export type SceneMode = 'clear' | 'rain' | 'snow' | 'night';

export interface NightLow {
  /** The morning the low happens on. */
  date: ISO;
  lowF: number;
}

export interface Weather {
  tempF: number | null;
  isDay: boolean;
  sky: Sky;
  /** Short description, e.g. 'Light Rain'. */
  text: string;
  lows: NightLow[];
  /** Rain over the last 7 days and the next 3, in inches. Null when unknown. */
  pastRainIn: number | null;
  nextRainIn: number | null;
  soilF: number | null;
  source: 'nws' | 'open-meteo' | 'nws + open-meteo';
  fetchedAt: number;
}

const cToF = (c: number) => (c * 9) / 5 + 32;

/** Read a National Weather Service short forecast such as 'Chance Rain Showers'. */
export function skyFromText(text: string): Sky {
  const t = text.toLowerCase();
  if (/snow|sleet|flurr|blizzard|wintry|ice pellets|freezing rain/.test(t)) return 'snow';
  if (/rain|shower|drizzle|thunder|storm/.test(t)) return 'rain';
  if (/cloud|overcast|fog|haze/.test(t) && !/partly|mostly sunny|mostly clear/.test(t)) return 'cloudy';
  return 'clear';
}

/** Read a WMO weather code (what Open-Meteo returns). */
export function skyFromWmo(code: number): Sky {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 3 || code === 45 || code === 48) return 'cloudy';
  return 'clear';
}

const WMO_TEXT: [number, string][] = [
  [0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Overcast'], [48, 'Fog'], [57, 'Drizzle'], [67, 'Rain'],
  [77, 'Snow'], [82, 'Rain showers'], [86, 'Snow showers'], [99, 'Thunderstorm'],
];
export const wmoText = (code: number): string => WMO_TEXT.find(([max]) => code <= max)?.[1] ?? 'Unknown';

/** The scene has four looks. Snow and rain win over night; cloudy days show as clear. */
export function sceneMode(w: Pick<Weather, 'sky' | 'isDay'> | null): SceneMode {
  if (!w) return 'clear'; // weather outage: fall back to a clear day
  if (w.sky === 'snow') return 'snow';
  if (w.sky === 'rain') return 'rain';
  return w.isDay ? 'clear' : 'night';
}

interface NwsPeriod {
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
}

const periodsOf = (json: unknown): NwsPeriod[] => {
  const p = (json as { properties?: { periods?: NwsPeriod[] } } | null)?.properties?.periods;
  return Array.isArray(p) ? p : [];
};
const nwsTempF = (p: NwsPeriod) => (p.temperatureUnit === 'C' ? cToF(p.temperature) : p.temperature);

/** Turn the NWS hourly and 7-day forecasts into what the app needs. Returns null if either is unusable. */
export function parseNws(hourly: unknown, daily: unknown): Pick<Weather, 'tempF' | 'isDay' | 'sky' | 'text' | 'lows'> | null {
  const now = periodsOf(hourly)[0];
  const days = periodsOf(daily);
  if (!now || typeof now.temperature !== 'number' || days.length === 0) return null;
  const lows = days
    .filter((p) => p.isDaytime === false && typeof p.temperature === 'number' && typeof p.endTime === 'string')
    .map((p) => ({ date: p.endTime.slice(0, 10), lowF: Math.round(nwsTempF(p)) }));
  return { tempF: Math.round(nwsTempF(now)), isDay: now.isDaytime !== false, sky: skyFromText(now.shortForecast ?? ''), text: now.shortForecast ?? '', lows };
}

interface OpenMeteoJson {
  current?: { temperature_2m?: number; is_day?: number; weather_code?: number; soil_temperature_6cm?: number };
  daily?: { time?: string[]; temperature_2m_min?: (number | null)[]; precipitation_sum?: (number | null)[] };
}

/**
 * Read an Open-Meteo forecast requested in °F and inches with past_days=7.
 * Gives current conditions (fallback), lows, rain totals and soil temperature.
 */
export function parseOpenMeteo(json: unknown, today: ISO): Omit<Weather, 'source' | 'fetchedAt'> | null {
  const j = json as OpenMeteoJson | null;
  const time = j?.daily?.time;
  if (!j?.current || !Array.isArray(time)) return null;
  const mins = j.daily?.temperature_2m_min ?? [];
  const rain = j.daily?.precipitation_sum ?? [];
  const lows: NightLow[] = [];
  let past = 0;
  let next = 0;
  let sawRain = false;
  const weekAgo = addDays(today, -7);
  const in3 = addDays(today, 2);
  time.forEach((date, i) => {
    const low = mins[i];
    if (date >= today && typeof low === 'number') lows.push({ date, lowF: Math.round(low) });
    const r = rain[i];
    if (typeof r !== 'number') return;
    sawRain = true;
    if (date >= weekAgo && date < today) past += r;
    else if (date >= today && date <= in3) next += r;
  });
  const code = j.current.weather_code ?? 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    tempF: typeof j.current.temperature_2m === 'number' ? Math.round(j.current.temperature_2m) : null,
    isDay: j.current.is_day !== 0,
    sky: skyFromWmo(code),
    text: wmoText(code),
    lows,
    pastRainIn: sawRain ? round2(past) : null,
    nextRainIn: sawRain ? round2(next) : null,
    soilF: typeof j.current.soil_temperature_6cm === 'number' ? Math.round(j.current.soil_temperature_6cm) : null,
  };
}

export const FROST_ALERT_F = 36; // leaves can frost before the air reaches 32°F
export const HARD_FREEZE_F = 28;

export interface FrostAlert {
  level: 'frost' | 'freeze';
  date: ISO;
  lowF: number;
  /** Names of plants in the ground that this cold will hurt. */
  plants: string[];
  text: string;
}

/**
 * Check the next three mornings for frost. `inGround` is the plants actually planted.
 * A frost (36°F or below) threatens tender plants; a hard freeze (28°F or below) also
 * threatens semi-hardy ones. Returns null when no cold is coming.
 */
export function frostAlert(lows: NightLow[], today: ISO, inGround: Plant[]): FrostAlert | null {
  const last = addDays(today, 2);
  const upcoming = lows.filter((l) => l.date >= today && l.date <= last && l.lowF <= FROST_ALERT_F);
  if (upcoming.length === 0) return null;
  const coldest = upcoming.reduce((a, b) => (b.lowF < a.lowF ? b : a));
  const level = coldest.lowF <= HARD_FREEZE_F ? 'freeze' : 'frost';
  const hurt = (p: Plant) => p.frost === 'tender' || p.frost === 'veryTender' || (level === 'freeze' && p.frost === 'semiHardy');
  const plants = [...new Set(inGround.filter(hurt).map((p) => p.name))];
  const when = coldest.date === today ? 'tonight' : `on the morning of ${fmtDate(coldest.date)}`;
  const what = level === 'freeze' ? 'Hard freeze' : 'Frost';
  const text = plants.length
    ? `${what} likely ${when}: low of ${coldest.lowF}°F. Cover or bring in: ${plants.join(', ')}.`
    : `${what} likely ${when}: low of ${coldest.lowF}°F. Nothing you have in the ground should mind.`;
  return { level, date: coldest.date, lowF: coldest.lowF, plants, text };
}
