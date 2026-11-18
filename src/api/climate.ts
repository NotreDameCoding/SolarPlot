import { addDays, frostFromHistory, frostFromStation, nearestStation, parseNws, parseOpenMeteo, type DailyMin, type FrostInfo, type ISO, type StationRow, type Weather } from '../engine';
import type { Place } from '../state/store';

/**
 * All network calls live here. Every function returns null (or []) on failure instead of
 * throwing, so the app keeps working offline and during a weather-service outage.
 *
 * Services used, all free and keyless:
 * - National Weather Service (api.weather.gov): current conditions and overnight lows. US only.
 * - Open-Meteo: place search, 10 years of temperature history for frost dates, rain totals,
 *   soil temperature, and a fallback forecast. Free for non-commercial use, which is why
 *   SolarPlot must stay free while it uses Open-Meteo.
 */
async function getJson(url: string, timeoutMs = 12000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string;
  country_code?: string;
}

/** Search for a US town or ZIP code. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const json = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json&countryCode=US`)) as { results?: GeoResult[] } | null;
  return (json?.results ?? [])
    .filter((r) => r.country_code === 'US' && typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map((r) => ({
      name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
      // Rounded to about half a mile: plenty for weather, and no more precise than a ZIP code.
      lat: Math.round(r.latitude * 100) / 100,
      lon: Math.round(r.longitude * 100) / 100,
      elev: typeof r.elevation === 'number' ? Math.round(r.elevation) : undefined,
    }));
}

let stations: Promise<StationRow[] | null> | null = null;

/** NOAA frost dates for ~thousands of US weather stations, shipped with the site (scripts/frost-data.mjs). */
function loadStations(): Promise<StationRow[] | null> {
  stations ??= fetch(new URL('frost-stations.json', document.baseURI).href)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { stations?: StationRow[] } | null) => (Array.isArray(d?.stations) ? d!.stations : null))
    .catch(() => null);
  return stations;
}

/**
 * Frost dates for a garden. First choice: NOAA's official 1991-2020 normals from the nearest
 * weather station (no API calls). Fallback: estimate from ten years of Open-Meteo daily lows,
 * which costs about 260 of Open-Meteo's free calls per lookup.
 */
export async function fetchFrost(place: Place, today: ISO): Promise<FrostInfo | null> {
  const rows = await loadStations();
  const near = rows ? nearestStation(rows, place.lat, place.lon, place.elev ?? null) : null;
  if (near) return frostFromStation(near.row, near.km);
  return estimateFrost(place, today);
}

async function estimateFrost(place: Place, today: ISO): Promise<FrostInfo | null> {
  const lastYear = Number(today.slice(0, 4)) - 1;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}&start_date=${lastYear - 9}-01-01&end_date=${lastYear}-12-31&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
  const json = (await getJson(url, 25000)) as { daily?: { time?: string[]; temperature_2m_min?: (number | null)[] } } | null;
  const time = json?.daily?.time;
  const mins = json?.daily?.temperature_2m_min;
  if (!Array.isArray(time) || !Array.isArray(mins)) return null;
  const days: DailyMin[] = time.map((date, i) => ({ date, minF: typeof mins[i] === 'number' ? mins[i] : null }));
  const frost = frostFromHistory(days);
  return frost.years >= 3 ? frost : null;
}

/** Current weather for the scene, alerts and the watering nudge. NWS first, Open-Meteo to fill gaps. */
export async function fetchWeather(place: Place, today: ISO): Promise<Weather | null> {
  const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,is_day,weather_code,soil_temperature_6cm&daily=temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&past_days=7&forecast_days=7`;

  const nws = (async () => {
    const points = (await getJson(`https://api.weather.gov/points/${place.lat.toFixed(4)},${place.lon.toFixed(4)}`)) as { properties?: { forecast?: string; forecastHourly?: string } } | null;
    const p = points?.properties;
    if (!p?.forecast || !p.forecastHourly) return null;
    const [hourly, daily] = await Promise.all([getJson(p.forecastHourly), getJson(p.forecast)]);
    return parseNws(hourly, daily);
  })();

  const [fromNws, meteoJson] = await Promise.all([nws, getJson(meteoUrl)]);
  const fromMeteo = parseOpenMeteo(meteoJson, today);
  if (!fromNws && !fromMeteo) return null;

  const fetchedAt = Date.now();
  if (fromNws && fromMeteo) {
    // Keep NWS lows, but add any later mornings only Open-Meteo covers.
    const lastNws = fromNws.lows.length ? fromNws.lows[fromNws.lows.length - 1].date : addDays(today, -1);
    const lows = [...fromNws.lows, ...fromMeteo.lows.filter((l) => l.date > lastNws)];
    return { ...fromMeteo, ...fromNws, lows, source: 'nws + open-meteo', fetchedAt };
  }
  if (fromNws) return { ...fromNws, pastRainIn: null, nextRainIn: null, soilF: null, source: 'nws', fetchedAt };
  return { ...fromMeteo!, source: 'open-meteo', fetchedAt };
}
