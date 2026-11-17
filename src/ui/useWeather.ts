import { useCallback, useEffect, useState } from 'react';
import { fetchWeather } from '../api/climate';
import { today, useStore } from '../state/store';

const FRESH_MS = 30 * 60 * 1000;

/** Keeps the saved weather up to date: refreshes when it is more than 30 minutes old. */
export function useWeather() {
  const place = useStore((s) => s.place);
  const weather = useStore((s) => s.weather);
  const setWeather = useStore((s) => s.setWeather);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!place) return;
    setLoading(true);
    const w = await fetchWeather(place, today());
    setLoading(false);
    setFailed(!w);
    if (w) setWeather(w); // on failure keep the last forecast we had
  }, [place, setWeather]);

  useEffect(() => {
    if (place && (!weather || Date.now() - weather.fetchedAt > FRESH_MS)) void refresh();
    // Only when the place changes or the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  const stale = !!weather && Date.now() - weather.fetchedAt > 6 * 60 * 60 * 1000;
  return { weather: stale ? null : weather, loading, failed, refresh };
}
